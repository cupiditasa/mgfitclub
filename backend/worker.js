/* MG FitClub API. D1 is the source of truth; secrets are Worker bindings. */
import { handleAttendancePilot } from './attendance-pilot.js';
import { handleMgBridge } from './mg-bridge.js';
import { handleWorkouts } from './workouts.js';
import { handleNutrition } from './nutrition.js';
import { handleCoachMarket } from './coach-market.js';
import { handleDeviceVerification, deviceStatesForUsers } from './device-verification.js';
const ROLES = new Set(["athlete", "coach", "manager", "admin", "secretary", "support"]);
const USER_STATUSES = new Set(["active", "blocked", "pending"]);
const REQUEST_STATUSES = new Set(["submitted", "assigned", "in_progress", "completed", "rejected"]);
const ENTRY_STATUSES = new Set(["pending", "approved", "rejected", "exited"]);
const PROGRAM_KINDS = new Set(["training", "food"]);
const API_VERSION = "20261005-coach-marketplace-1";
const SUPPORT_PHONE = "09174922677";
const APPROVAL_NOTICE = "فقط کاربران باشگاه می‌توانند ثبت‌نام کنند. درخواست شما پس از تأیید شماره برای مدیریت ارسال خواهد شد؛ پس از تأیید مدیر، دسترسی شما باز می‌شود.";
const SMS_VERIFY_TEMPLATE_ID = 791767;
const SMS_VERIFY_ENDPOINT = "https://api.sms.ir/v1/send/verify";

const response = (data, status, headers) =>
  new Response(JSON.stringify(data), {
    status: status || 200,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
      ...(headers || {}),
    },
  });
const errorResponse = (message, status, headers) => response({ error: message }, status || 400, headers);
const now = () => Math.floor(Date.now() / 1000);
const makeId = (prefix) => prefix + "_" + crypto.randomUUID();
const token = () => crypto.randomUUID().replaceAll("-", "") + crypto.randomUUID().replaceAll("-", "");
const faDigits = "۰۱۲۳۴۵۶۷۸۹";
const normalizeDigits = (value) => String(value || "").replace(/[۰-۹]/g, (x) => String(faDigits.indexOf(x)));
const normalizePhone = (value) => {
  let phone = normalizeDigits(value).replace(/[\s()-]/g, "");
  if (phone.startsWith("+98")) phone = "0" + phone.slice(3);
  if (phone.startsWith("0098")) phone = "0" + phone.slice(4);
  return phone;
};
const validPhone = (value) => /^09\d{9}$/.test(value);
const validEmail = (value) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
const otpCode = () => {
  const bytes = new Uint32Array(1);
  const limit = Math.floor(0x100000000 / 900000) * 900000;
  do { crypto.getRandomValues(bytes); } while (bytes[0] >= limit);
  return String(100000 + bytes[0] % 900000);
};

async function hash(value) {
  const bytes = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(String(value)));
  return Array.from(new Uint8Array(bytes)).map((x) => x.toString(16).padStart(2, "0")).join("");
}
async function jsonBody(request, limit) {
  const maximum = limit || 32768;
  if (Number(request.headers.get("content-length") || 0) > maximum)
    throw Object.assign(new Error("payload_too_large"), { status: 413 });
  const reader = request.body?.getReader();
  if (!reader) return {};
  const chunks = [];
  let size = 0;
  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > maximum) {
      await reader.cancel();
      throw Object.assign(new Error("payload_too_large"), { status: 413 });
    }
    chunks.push(value);
  }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length; }
  try { const data = JSON.parse(new TextDecoder().decode(bytes)); return data && typeof data === "object" && !Array.isArray(data) ? data : {}; }
  catch { throw Object.assign(new Error("invalid_json"), { status: 400 }); }
}
function cors(request, env) {
  const origin = request.headers.get("Origin") || "";
  const list = String(env.APP_ORIGIN || "*").split(",").map((x) => x.trim()).filter(Boolean);
  const allowed = list.includes("*") || list.includes(origin) ? origin || "*" : list[0] || "*";
  return {
    "access-control-allow-origin": allowed,
    "access-control-allow-methods": "GET,POST,PATCH,OPTIONS",
    "access-control-allow-headers": "content-type, authorization, idempotency-key",
    "access-control-max-age": "86400",
    vary: "Origin",
  };
}
function publicUser(user) {
  if (!user) return null;
  const copy = { ...user };
  delete copy.password_hash;
  if (copy.effective_role) {
    copy.role = copy.effective_role;
    delete copy.effective_role;
  }
  return copy;
}
function roleOf(user) {
  return user && (user.effective_role || user.role);
}
function hasRole(user, ...roles) {
  return Boolean(user && roles.includes(roleOf(user)));
}
async function audit(env, actorId, action, entityType, entityId, metadata) {
  await env.DB.prepare(
    "INSERT INTO audit_logs (id,actor_id,action,entity_type,entity_id,metadata_json) VALUES (?,?,?,?,?,?)",
  ).bind(makeId("log"), actorId || null, action, entityType || null, entityId || null, JSON.stringify(metadata || {})).run();
}
async function limited(env, rawKey, maximum, seconds) {
  const key = await hash(rawKey);
  const expiry = now() + seconds;
  await env.DB.prepare(
    "INSERT INTO api_limits (key,count,expires_at) VALUES (?,1,?) ON CONFLICT(key) DO UPDATE SET count=CASE WHEN api_limits.expires_at<=? THEN 1 ELSE api_limits.count+1 END,expires_at=CASE WHEN api_limits.expires_at<=? THEN ? ELSE api_limits.expires_at END",
  ).bind(key, expiry, now(), now(), expiry).run();
  const row = await env.DB.prepare("SELECT count,expires_at FROM api_limits WHERE key=?").bind(key).first();
  return Boolean(row && row.expires_at > now() && row.count <= maximum);
}
async function challengeHash(env, id, code) {
  const secret = String(env.OTP_SECRET || "").trim();
  if (!secret) throw Object.assign(new Error("OTP_SECRET is not configured"), { status: 503 });
  return hash(secret + ":" + id + ":" + code);
}
async function userById(env, userId) {
  const user = await env.DB.prepare(
    "SELECT u.*,COALESCE(ur.role,u.role) AS effective_role FROM users u LEFT JOIN user_roles ur ON ur.user_id=u.id WHERE u.id=?",
  ).bind(userId).first();
  return accessUser(env, user);
}
async function accessUser(env, user) {
  if (!user) return null;
  const access = await env.DB.prepare("SELECT a.*,c.name AS club_name FROM account_access a LEFT JOIN clubs c ON c.id=a.club_id WHERE a.user_id=?").bind(user.id).first();
  let role = access?.role || roleOf(user);
  if (role === "admin") role = "manager";
  let state = access?.state || (role === "athlete" ? "approved" : "pending");
  if (role === "support" && user.phone !== SUPPORT_PHONE) state = "rejected";
  if (user.status === "pending") state = "pending";
  if (role === "manager") {
    const club = await env.DB.prepare("SELECT id FROM clubs WHERE manager_user_id=?").bind(user.id).first();
    if (!club || club.id !== access?.club_id) state = "pending";
  }
  return { ...user, effective_role: role, access_state: state, club_id: access?.club_id || null, club_name: access?.club_name || null };
}
async function currentUser(request, env) {
  const auth = request.headers.get("authorization") || "";
  const raw = auth.startsWith("Bearer ") ? auth.slice(7).trim() : "";
  if (!raw) return null;
  const digest = await hash(raw);
  const user = await env.DB.prepare(
    "SELECT u.*,COALESCE(ur.role,u.role) AS effective_role FROM sessions s JOIN users u ON u.id=s.user_id LEFT JOIN user_roles ur ON ur.user_id=u.id WHERE s.token_hash IN (?,?) AND s.revoked_at IS NULL AND datetime(s.expires_at)>datetime('now') AND u.status IN ('active','pending')",
  ).bind(digest, raw).first();
  return accessUser(env, user);
}
async function issueSession(env, user) {
  const sessionToken = token();
  await env.DB.prepare(
    "INSERT INTO sessions (id,user_id,token_hash,expires_at) VALUES (?,?,?,datetime('now','+30 days'))",
  ).bind(makeId("sess"), user.id, await hash(sessionToken)).run();
  return sessionToken;
}
async function setPersonalRole(env, userId, role, clubId) {
  const statements = [
    env.DB.prepare("UPDATE access_requests SET state='cancelled',reviewed_at=datetime('now') WHERE user_id=? AND state='pending'").bind(userId),
    env.DB.prepare("INSERT INTO account_access (user_id,role,club_id,state) VALUES (?,?,?,?) ON CONFLICT(user_id) DO UPDATE SET role=excluded.role,club_id=excluded.club_id,state=excluded.state,reviewed_by=NULL,updated_at=datetime('now')")
      .bind(userId, role, clubId || null, role === "athlete" ? "approved" : "pending"),
    env.DB.prepare("INSERT INTO user_roles (user_id,role) VALUES (?,?) ON CONFLICT(user_id) DO UPDATE SET role=excluded.role").bind(userId, role),
  ];
  if (role !== "athlete") statements.push(env.DB.prepare("INSERT INTO access_requests (id,user_id,club_id,role) VALUES (?,?,?,?)").bind(makeId("access"), userId, clubId, role));
  await env.DB.batch(statements);
}
async function loginClub(env, phone) {
  return env.DB.prepare("SELECT c.* FROM club_login_phones p JOIN clubs c ON c.id=p.club_id WHERE p.phone=?").bind(phone).first();
}
async function registrationIntent(env, body, phone) {
  const role = String(body.role || "athlete");
  if (!ROLES.has(role)) throw Object.assign(new Error("invalid_role"), { status: 400 });
  if (role === "support" && phone !== SUPPORT_PHONE) throw Object.assign(new Error("support_phone_only"), { status: 403 });
  if ((role === "manager" || role === "admin") && !(await loginClub(env, phone)))
    throw Object.assign(new Error("club_account_required"), { status: 403 });
  let clubId = null;
  if (role === "coach" || role === "secretary") {
    const club = await env.DB.prepare("SELECT id FROM clubs WHERE id=?").bind(String(body.clubId || "")).first();
    if (!club) throw Object.assign(new Error("club_required"), { status: 400 });
    clubId = club.id;
  }
  return { role, clubId };
}
async function sendSms(env, mobile, code) {
  const key = String(env.SMS_API_KEY || "").trim();
  const templateId = Number(env.SMS_TEMPLATE_ID || SMS_VERIFY_TEMPLATE_ID);
  // Login codes must use the approved MG template, never a custom/bulk sender.
  // SMS.ir chooses the verification service line; SMS_LINE_NUMBER is not used.
  if (!key || templateId !== SMS_VERIFY_TEMPLATE_ID)
    return { sent: false, reason: "sms_provider_not_configured" };
  try {
    const result = await fetch(SMS_VERIFY_ENDPOINT, {
      method: "POST",
      headers: { "X-API-KEY": key, "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({
        Mobile: normalizePhone(mobile),
        TemplateId: SMS_VERIFY_TEMPLATE_ID,
        Parameters: [{ name: "CODE", value: String(code) }],
      }),
      signal: AbortSignal.timeout(10000),
    });
    const data = await result.json().catch(() => ({}));
    const providerStatus = Number(data?.status);
    const messageId = Number(data?.data?.messageId);
    const validMessageId = Number.isSafeInteger(messageId) && messageId > 0;
    return {
      // Provider acceptance is not a handset delivery receipt.
      sent: result.ok && providerStatus === 1 && validMessageId,
      providerStatus: Number.isInteger(providerStatus) ? providerStatus : null,
      messageId: validMessageId ? messageId : null,
    };
  } catch {
    // Do not retry via a different line: a timed-out request may be queued.
    return { sent: false, reason: "sms_provider_unavailable" };
  }
}
async function dashboard(user, env) {
  if (hasRole(user, "athlete")) {
    const values = await Promise.all([
      env.DB.prepare("SELECT * FROM orders WHERE user_id=? ORDER BY created_at DESC LIMIT 20").bind(user.id).all(),
      env.DB.prepare("SELECT * FROM training_requests WHERE user_id=? ORDER BY created_at DESC LIMIT 20").bind(user.id).all(),
      env.DB.prepare("SELECT d.* FROM training_deliverables d JOIN training_requests r ON r.id=d.request_id WHERE r.user_id=? ORDER BY d.created_at DESC LIMIT 20").bind(user.id).all(),
      env.DB.prepare("SELECT * FROM entry_requests WHERE user_id=? ORDER BY created_at DESC LIMIT 20").bind(user.id).all(),
      env.DB.prepare("SELECT COUNT(*) AS count FROM club_messages WHERE recipient_id=?").bind(user.id).first(),
    ]);
    return { user: publicUser(user), orders: values[0].results, trainingRequests: values[1].results, deliverables: values[2].results, entryRequests: values[3].results, unreadMessages: values[4]?.count || 0 };
  }
  if (hasRole(user, "coach")) {
    const values = await Promise.all([
      env.DB.prepare("SELECT * FROM training_requests WHERE coach_id=? OR (coach_id IS NULL AND status='submitted') ORDER BY created_at DESC LIMIT 100").bind(user.id).all(),
      env.DB.prepare("SELECT * FROM training_plans WHERE is_active=1 AND (created_by=? OR created_by IS NULL) ORDER BY created_at DESC LIMIT 100").bind(user.id).all(),
      env.DB.prepare("SELECT * FROM coach_programs WHERE coach_id=? AND is_active=1 ORDER BY updated_at DESC LIMIT 100").bind(user.id).all(),
      env.DB.prepare("SELECT COUNT(*) AS count FROM training_requests WHERE coach_id=?").bind(user.id).first(),
      env.DB.prepare("SELECT COUNT(*) AS count FROM training_requests WHERE status='submitted' AND coach_id IS NULL").first(),
    ]);
    return { user: publicUser(user), trainingRequests: values[0].results, trainingPlans: values[1].results, coachPrograms: values[2].results, stats: { assigned: values[3]?.count || 0, pending: values[4]?.count || 0 } };
  }
  if (hasRole(user, "manager", "admin", "secretary", "support")) {
    const values = await Promise.all([
      env.DB.prepare("SELECT u.*,COALESCE(a.role,ur.role,u.role) AS effective_role,COALESCE(a.state,CASE WHEN COALESCE(ur.role,u.role)='athlete' THEN 'approved' ELSE 'pending' END) AS access_state FROM users u LEFT JOIN user_roles ur ON ur.user_id=u.id LEFT JOIN account_access a ON a.user_id=u.id ORDER BY u.created_at DESC LIMIT 500").all(),
      env.DB.prepare("SELECT * FROM training_requests ORDER BY created_at DESC LIMIT 200").all(),
      env.DB.prepare("SELECT * FROM orders ORDER BY created_at DESC LIMIT 200").all(),
    ]);
    return { user: publicUser(user), users: values[0].results.map(publicUser), trainingRequests: values[1].results, orders: values[2].results };
  }
  return { user: publicUser(user) };
}
async function createTrainingRequest(env, user, body, request) {
  if (!hasRole(user, "athlete")) return errorResponse("athlete_only", 403);
  const planId = String(body.planId || body.plan_id || "");
  const plan = await env.DB.prepare("SELECT * FROM training_plans WHERE id=? AND is_active=1").bind(planId).first();
  if (!plan) return errorResponse("training_plan_required", 400);
  const key = request.headers.get("idempotency-key") || String(body.idempotencyKey || "");
  if (key.length < 16 || key.length > 128) return errorResponse("idempotency_key_required", 400);
  const fingerprint = await hash(JSON.stringify({ planId, goal: body.goal || "", heightCm: body.heightCm || null, weightKg: body.weightKg || null, notes: body.notes || "" }));
  const operationKey = "training:" + user.id + ":" + key;
  const previous = await env.DB.prepare("SELECT * FROM api_operations WHERE key=?").bind(operationKey).first();
  if (previous) return previous.fingerprint === fingerprint ? response({ ok: true, duplicate: true, requestId: previous.resource_id }, 200) : errorResponse("idempotency_key_reused", 409);
  const orderId = makeId("order");
  const requestId = makeId("training_request");
  try {
    await env.DB.batch([
      env.DB.prepare("INSERT INTO orders (id,user_id,order_type,item_id,amount) VALUES (?,?,?,?,?)").bind(orderId, user.id, "training", plan.id, plan.price),
      env.DB.prepare("INSERT INTO training_requests (id,order_id,user_id,plan_id,height_cm,weight_kg,goal,experience_level,injuries,availability,notes,status) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)").bind(requestId, orderId, user.id, plan.id, body.heightCm || null, body.weightKg || null, body.goal || null, body.experienceLevel || null, body.injuries || null, body.availability || null, body.notes || null, "submitted"),
      env.DB.prepare("INSERT INTO api_operations (key,user_id,fingerprint,resource_id) VALUES (?,?,?,?)").bind(operationKey, user.id, fingerprint, requestId),
    ]);
  } catch (e) {
    const retry = await env.DB.prepare("SELECT * FROM api_operations WHERE key=?").bind(operationKey).first();
    if (retry && retry.fingerprint === fingerprint) return response({ ok: true, duplicate: true, requestId: retry.resource_id }, 200);
    throw e;
  }
  await audit(env, user.id, "training_request_created", "training_request", requestId, { planId });
  return response({ ok: true, requestId, orderId, status: "submitted" }, 201);
}

async function handle(request, env) {
  const headers = cors(request, env);
  if (request.method === "OPTIONS") return new Response(null, { status: 204, headers });
  const path = new URL(request.url).pathname.replace(/\/+$/, "") || "/";
  const coachMarket = await handleCoachMarket(request, env, {path,headers,response,errorResponse,jsonBody,currentUser,hasRole,makeId});
  if (coachMarket) return coachMarket;
  const nutrition = await handleNutrition(request, env, {path,headers,response,errorResponse,jsonBody,hash,currentUser,userById,hasRole,makeId,normalizePhone});
  if (nutrition) return nutrition;
  const workout = await handleWorkouts(request, env, {path,headers,response,errorResponse,jsonBody,hash,currentUser,userById,hasRole,makeId,normalizePhone});
  if (workout) return workout;
  const mgBridge = await handleMgBridge(request, env, {path,headers,response,errorResponse,jsonBody,hash,currentUser,userById,hasRole,makeId,token,normalizePhone});
  if (mgBridge) return mgBridge;
  const device = await handleDeviceVerification(request, env, {path,headers,response,errorResponse,jsonBody,hash,currentUser,userById,hasRole,makeId,token});
  if (device) return device;
  const pilot = await handleAttendancePilot(request, env, {path,headers,response,errorResponse,jsonBody,hash,currentUser,userById,hasRole,normalizePhone,validPhone,makeId,token});
  if (pilot) return pilot;
  if (path === "/health" && request.method === "GET") return response({
    ok: true,
    service: "mg-fitclub-api",
    version: API_VERSION,
    otp: { provider: "sms.ir", method: "verify", templateId: SMS_VERIFY_TEMPLATE_ID, parameter: "CODE" },
  }, 200, headers);
  if (path === "/api/plans/training" && request.method === "GET") {
    const result = await env.DB.prepare("SELECT * FROM training_plans WHERE is_active=1 ORDER BY price").all();
    return response({ plans: result.results }, 200, headers);
  }
  if (path === "/api/plans/membership" && request.method === "GET") {
    const result = await env.DB.prepare("SELECT * FROM membership_plans WHERE is_active=1 ORDER BY price").all();
    return response({ plans: result.results }, 200, headers);
  }
  if (path === "/api/clubs" && request.method === "GET") {
    const result = await env.DB.prepare("SELECT id,name FROM clubs ORDER BY name").all();
    return response({ clubs: result.results }, 200, headers);
  }
  if (path === "/api/auth/request-code" && request.method === "POST") {
    const body = await jsonBody(request, 4096);
    const phone = body.phone ? normalizePhone(body.phone) : "";
    const email = body.email ? String(body.email).trim().toLowerCase() : "";
    const target = phone || email;
    if (!target || (phone && !validPhone(phone)) || (email && !validEmail(email))) return errorResponse("valid_phone_or_email_required", 400, headers);
    const intent = await registrationIntent(env, body, phone);
    if (!(await limited(env, "otp-target:" + target, 5, 600))) return errorResponse("too_many_requests", 429, headers);
    const ip = request.headers.get("CF-Connecting-IP") || request.headers.get("x-forwarded-for") || "unknown";
    if (!(await limited(env, "otp-ip:" + ip, 30, 600))) return errorResponse("too_many_requests", 429, headers);
    const challengeId = makeId("challenge");
    const code = otpCode();
    const user = await env.DB.prepare("SELECT id FROM users WHERE " + (phone ? "phone" : "email") + "=?").bind(target).first();
    await env.DB.prepare("INSERT INTO login_challenges (id,target,code_hash,expires_at,created_at) VALUES (?,?,?,?,?)").bind(challengeId, target, await challengeHash(env, challengeId, code), now() + 600, now()).run();
    await env.DB.prepare("INSERT INTO login_intents (challenge_id,requested_role,club_id) VALUES (?,?,?)").bind(challengeId, intent.role, intent.clubId).run();
    const sent = phone
      ? await sendSms(env, target, code)
      : { sent: false, reason: "email_provider_not_configured" };
    await env.DB.prepare("UPDATE login_challenges SET delivery_status=? WHERE id=?").bind(sent.sent ? "sent" : "failed", challengeId).run();
    await audit(env, user?.id, "auth_code_requested", "login_challenge", challengeId, {
      channel: phone ? "phone" : "email",
      sent: sent.sent,
      ...(phone ? {
        smsMethod: "verify",
        templateId: SMS_VERIFY_TEMPLATE_ID,
        providerStatus: sent.providerStatus ?? null,
        messageId: sent.messageId ?? null,
        failureReason: sent.sent ? null : sent.reason || "sms_provider_rejected",
      } : {}),
    });
    if (!sent.sent) return errorResponse("code_delivery_failed", 503, headers);
    return response({ ok: true, delivery: "sent", challengeId, notice: ["coach", "secretary"].includes(intent.role) ? APPROVAL_NOTICE : null, ...(env.ENVIRONMENT === "test" && env.DEV_MODE === "true" ? { devCode: code } : {}) }, 202, headers);
  }
  if (path === "/api/auth/verify-code" && request.method === "POST") {
    const body = await jsonBody(request, 4096);
    const phone = body.phone ? normalizePhone(body.phone) : "";
    const email = body.email ? String(body.email).trim().toLowerCase() : "";
    const target = phone || email;
    const code = normalizeDigits(body.code);
    if (!target || !/^\d{6}$/.test(code)) return errorResponse("target_and_six_digit_code_required", 400, headers);
    const challenge = body.challengeId
      ? await env.DB.prepare("SELECT * FROM login_challenges WHERE id=? AND target=?").bind(String(body.challengeId), target).first()
      : await env.DB.prepare("SELECT * FROM login_challenges WHERE target=? ORDER BY created_at DESC LIMIT 1").bind(target).first();
    if (!challenge || challenge.delivery_status !== "sent" || challenge.consumed_at || challenge.expires_at <= now() || challenge.attempts >= 5) return errorResponse("invalid_or_expired_code", 401, headers);
    await env.DB.prepare("UPDATE login_challenges SET attempts=attempts+1 WHERE id=? AND consumed_at IS NULL AND attempts<5").bind(challenge.id).run();
    if ((await challengeHash(env, challenge.id, code)) !== challenge.code_hash) return errorResponse("invalid_or_expired_code", 401, headers);
    const consumed = await env.DB.prepare("UPDATE login_challenges SET consumed_at=? WHERE id=? AND consumed_at IS NULL").bind(now(), challenge.id).run();
    if (!consumed.meta || consumed.meta.changes !== 1) return errorResponse("invalid_or_expired_code", 401, headers);
    const column = phone ? "phone" : "email";
    const intent = await env.DB.prepare("SELECT * FROM login_intents WHERE challenge_id=?").bind(challenge.id).first();
    const clubLogin = intent && ["manager", "admin"].includes(intent.requested_role);
    const club = phone && clubLogin ? await loginClub(env, phone) : null;
    if (clubLogin && !club) return errorResponse("club_account_required", 403, headers);
    // The verified phone selects the shared club account; client role is never authority.
    let user = club ? { id: club.manager_user_id } : await env.DB.prepare("SELECT id FROM users WHERE " + column + "=?").bind(target).first();
    const isNew = !user;
    if (!user) {
      const userId = makeId("user");
      await env.DB.prepare("INSERT INTO users (id," + column + ",role,status) VALUES (?,?,?,?)").bind(userId, target, "athlete", "active").run();
      user = { id: userId };
    }
    user = await userById(env, user.id);
    if (!user || user.status !== "active") return errorResponse("account_inactive", 403, headers);
    if (phone === SUPPORT_PHONE && !club) {
      if (roleOf(user) !== "support" || user.access_state !== "approved")
        await env.DB.prepare("UPDATE sessions SET revoked_at=datetime('now') WHERE user_id=?").bind(user.id).run();
      await env.DB.batch([
        env.DB.prepare("INSERT INTO account_access (user_id,role,state) VALUES (?,'support','approved') ON CONFLICT(user_id) DO UPDATE SET role='support',state='approved',club_id=NULL,updated_at=datetime('now')").bind(user.id),
        env.DB.prepare("INSERT INTO user_roles (user_id,role) VALUES (?,'support') ON CONFLICT(user_id) DO UPDATE SET role='support'").bind(user.id),
        env.DB.prepare("UPDATE access_requests SET state='cancelled' WHERE user_id=? AND state='pending'").bind(user.id),
      ]);
    } else if (intent && ["coach", "secretary"].includes(intent.requested_role) && !club &&
        (isNew || (hasRole(user, "athlete", "coach", "secretary") && roleOf(user) !== intent.requested_role))) {
      await setPersonalRole(env, user.id, intent.requested_role, intent.club_id);
    }
    user = await userById(env, user.id);
    const sessionToken = await issueSession(env, user);
    await audit(env, user.id, "auth_login", "session", user.id, { role: roleOf(user), channel: phone ? "phone" : "email" });
    return response({ ok: true, token: sessionToken, user: publicUser(user) }, 200, headers);
  }
  if (path === "/api/auth/test-login" && request.method === "POST") {
    if (env.ENVIRONMENT !== "test" || String(env.TEST_MODE || "").toLowerCase() !== "true") return errorResponse("not_found", 404, headers);
    const body = await jsonBody(request, 4096);
    const account = await env.DB.prepare("SELECT t.*,u.status FROM test_accounts t JOIN users u ON u.id=t.user_id WHERE t.username=? AND t.enabled=1").bind(String(body.username || "").trim()).first();
    if (!account || account.status !== "active" || account.password_hash !== await hash(String(body.password || "")))
      return errorResponse("invalid_credentials", 401, headers);
    const testUser = await userById(env, account.user_id);
    const sessionToken = await issueSession(env, testUser);
    return response({ ok: true, token: sessionToken, user: publicUser(testUser) }, 200, headers);
  }
  const user = await currentUser(request, env);
  if (path === "/api/auth/logout" && request.method === "POST") {
    const raw = (request.headers.get("authorization") || "").replace(/^Bearer\s+/i, "").trim();
    if (raw) await env.DB.prepare("UPDATE sessions SET revoked_at=datetime('now') WHERE token_hash IN (?,?)").bind(raw, await hash(raw)).run();
    return response({ ok: true }, 200, headers);
  }
  if (path === "/api/me" && request.method === "GET") return user ? response({ user: publicUser(user) }, 200, headers) : errorResponse("unauthorized", 401, headers);
  if (!user) return errorResponse("unauthorized", 401, headers);

  if (path === "/api/me/profile" && request.method === "GET") {
    const profile = await env.DB.prepare("SELECT first_name,last_name,avatar_data FROM user_profiles WHERE user_id=?").bind(user.id).first();
    return response({ profile: profile || { first_name: "", last_name: "", avatar_data: null }, user: publicUser(user) }, 200, headers);
  }
  if (path === "/api/me/profile" && request.method === "PATCH") {
    if (hasRole(user, "manager")) return errorResponse("club_profile_managed_by_support", 403, headers);
    const body = await jsonBody(request, 180000);
    const first = String(body.firstName || "").trim(), last = String(body.lastName || "").trim();
    if (!first || !last || first.length > 80 || last.length > 80) return errorResponse("first_and_last_name_required", 400, headers);
    let avatar = body.avatarData;
    if (avatar !== undefined && avatar !== null) {
      if (typeof avatar !== "string" || avatar.length > 160000 || !/^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/]+={0,2}$/.test(avatar)) return errorResponse("invalid_avatar", 400, headers);
      const [prefix, data] = avatar.split(",");
      let bytes;
      try { bytes = atob(data); } catch { return errorResponse("invalid_avatar", 400, headers); }
      const valid = prefix.includes("jpeg") ? bytes.startsWith("\xff\xd8\xff") : prefix.includes("png") ? bytes.startsWith("\x89PNG\r\n\x1a\n") : bytes.startsWith("RIFF") && bytes.slice(8, 12) === "WEBP";
      if (!valid) return errorResponse("invalid_avatar", 400, headers);
    } else if (avatar === undefined) {
      avatar = (await env.DB.prepare("SELECT avatar_data FROM user_profiles WHERE user_id=?").bind(user.id).first())?.avatar_data || null;
    }
    await env.DB.batch([
      env.DB.prepare("INSERT INTO user_profiles (user_id,first_name,last_name,avatar_data) VALUES (?,?,?,?) ON CONFLICT(user_id) DO UPDATE SET first_name=excluded.first_name,last_name=excluded.last_name,avatar_data=excluded.avatar_data,updated_at=datetime('now')").bind(user.id, first, last, avatar),
      env.DB.prepare("UPDATE users SET full_name=?,updated_at=datetime('now') WHERE id=?").bind(first + " " + last, user.id),
    ]);
    return response({ ok: true, user: publicUser(await userById(env, user.id)) }, 200, headers);
  }
  if (path === "/api/me/role" && request.method === "POST") {
    if (hasRole(user, "manager", "support") || user.phone === SUPPORT_PHONE) return errorResponse("managed_role_cannot_change", 403, headers);
    const body = await jsonBody(request, 4096);
    if (!["athlete", "coach", "secretary"].includes(body.role)) return errorResponse("invalid_role", 400, headers);
    const intent = await registrationIntent(env, body, user.phone);
    await setPersonalRole(env, user.id, intent.role, intent.clubId);
    await audit(env, user.id, "role_requested", "user", user.id, intent);
    return response({ ok: true, user: publicUser(await userById(env, user.id)) }, 200, headers);
  }
  if (user.access_state !== "approved") return errorResponse("approval_required", 403, headers);
  if (path === "/api/dashboard" && request.method === "GET") return response(await dashboard(user, env), 200, headers);

  if (path === "/api/support/clubs" && request.method === "GET") {
    if (!hasRole(user, "support")) return errorResponse("forbidden", 403, headers);
    const clubs = (await env.DB.prepare("SELECT * FROM clubs ORDER BY created_at DESC").all()).results;
    const phones = (await env.DB.prepare("SELECT club_id,phone FROM club_login_phones ORDER BY phone").all()).results;
    return response({ clubs: clubs.map(club => ({ ...club, phones: phones.filter(p => p.club_id === club.id).map(p => p.phone) })) }, 200, headers);
  }
  const clubMatch = path.match(/^\/api\/support\/clubs\/([^/]+)$/);
  if ((path === "/api/support/clubs" && request.method === "POST") || (clubMatch && request.method === "PATCH")) {
    if (!hasRole(user, "support")) return errorResponse("forbidden", 403, headers);
    const body = await jsonBody(request, 8192);
    const name = String(body.name || "").trim(), managerName = String(body.managerName || "").trim();
    const phones = Array.isArray(body.phones) ? body.phones.map(normalizePhone) : [];
    if (!name || name.length > 120 || !managerName || managerName.length > 160 || !phones.length || phones.length > 10 || new Set(phones).size !== phones.length || phones.some(p => !validPhone(p) || p === SUPPORT_PHONE))
      return errorResponse("invalid_club_details", 400, headers);
    const existing = clubMatch ? await env.DB.prepare("SELECT * FROM clubs WHERE id=?").bind(clubMatch[1]).first() : null;
    if (clubMatch && !existing) return errorResponse("club_not_found", 404, headers);
    for (const phone of phones) {
      const owner = await env.DB.prepare("SELECT club_id FROM club_login_phones WHERE phone=?").bind(phone).first();
      // Personal accounts remain separate; only an explicit manager login uses this alias.
      if (owner && owner.club_id !== existing?.id) return errorResponse("phone_already_in_use", 409, headers);
    }
    const clubId = existing?.id || makeId("club"), managerId = existing?.manager_user_id || makeId("user");
    const changes = [];
    if (!existing) {
      changes.push(env.DB.prepare("INSERT INTO users (id,full_name,role,status) VALUES (?,?,'manager','active')").bind(managerId, managerName));
      changes.push(env.DB.prepare("INSERT INTO clubs (id,name,manager_name,manager_user_id,created_by) VALUES (?,?,?,?,?)").bind(clubId, name, managerName, managerId, user.id));
      changes.push(env.DB.prepare("INSERT INTO account_access (user_id,role,club_id,state,reviewed_by) VALUES (?,'manager',?,'approved',?)").bind(managerId, clubId, user.id));
      changes.push(env.DB.prepare("INSERT INTO user_roles (user_id,role) VALUES (?,'manager')").bind(managerId));
    } else {
      changes.push(env.DB.prepare("UPDATE clubs SET name=?,manager_name=? WHERE id=?").bind(name, managerName, clubId));
      changes.push(env.DB.prepare("UPDATE users SET full_name=?,updated_at=datetime('now') WHERE id=?").bind(managerName, managerId));
      changes.push(env.DB.prepare("DELETE FROM club_login_phones WHERE club_id=?").bind(clubId));
      // A removed shared login number must lose its existing sessions too.
      changes.push(env.DB.prepare("UPDATE sessions SET revoked_at=datetime('now') WHERE user_id=?").bind(managerId));
    }
    for (const phone of phones) changes.push(env.DB.prepare("INSERT INTO club_login_phones (phone,club_id) VALUES (?,?)").bind(phone, clubId));
    await env.DB.batch(changes);
    await audit(env, user.id, existing ? "club_updated" : "club_created", "club", clubId, { phoneCount: phones.length });
    return response({ ok: true, clubId }, existing ? 200 : 201, headers);
  }
  if (path === "/api/access-requests" && request.method === "GET") {
    if (!hasRole(user, "manager", "support")) return errorResponse("forbidden", 403, headers);
    const result = await env.DB.prepare("SELECT r.*,u.full_name,u.phone,c.name AS club_name FROM access_requests r JOIN users u ON u.id=r.user_id JOIN clubs c ON c.id=r.club_id WHERE r.state='pending' AND (?='support' OR c.manager_user_id=?) ORDER BY r.created_at")
      .bind(roleOf(user), user.id).all();
    return response({ requests: result.results }, 200, headers);
  }
  const approvalMatch = path.match(/^\/api\/access-requests\/([^/]+)$/);
  if (approvalMatch && request.method === "PATCH") {
    // Only the requested club's manager approves its coach/secretary.
    if (!hasRole(user, "manager")) return errorResponse("club_manager_only", 403, headers);
    const body = await jsonBody(request, 2048);
    if (!["approved", "rejected"].includes(body.state)) return errorResponse("invalid_state", 400, headers);
    const item = await env.DB.prepare("SELECT r.* FROM access_requests r JOIN clubs c ON c.id=r.club_id WHERE r.id=? AND c.manager_user_id=?").bind(approvalMatch[1], user.id).first();
    if (!item) return errorResponse("request_not_found", 404, headers);
    if (item.state !== "pending") return errorResponse("request_already_reviewed", 409, headers);
    const result = await env.DB.batch([
      env.DB.prepare("UPDATE account_access SET state=?,reviewed_by=?,updated_at=datetime('now') WHERE user_id=? AND role=? AND club_id=? AND state='pending' AND EXISTS (SELECT 1 FROM access_requests WHERE id=? AND state='pending')")
        .bind(body.state, user.id, item.user_id, item.role, item.club_id, item.id),
      env.DB.prepare("UPDATE access_requests SET state=?,reviewed_by=?,reviewed_at=datetime('now') WHERE id=? AND state='pending'").bind(body.state, user.id, item.id),
    ]);
    if (result[0].meta.changes !== 1) return errorResponse("request_no_longer_current", 409, headers);
    await audit(env, user.id, "access_" + body.state, "access_request", item.id, {});
    return response({ ok: true }, 200, headers);
  }

  if (path === "/api/training-requests" && request.method === "POST") {
    const result = await createTrainingRequest(env, user, await jsonBody(request), request);
    return response(await result.json(), result.status, headers);
  }
  if (path === "/api/training-requests" && request.method === "GET") {
    let result;
    if (hasRole(user, "athlete")) result = await env.DB.prepare("SELECT * FROM training_requests WHERE user_id=? ORDER BY created_at DESC LIMIT 100").bind(user.id).all();
    else if (hasRole(user, "coach")) result = await env.DB.prepare("SELECT * FROM training_requests WHERE coach_id=? OR (coach_id IS NULL AND status='submitted') ORDER BY created_at DESC LIMIT 100").bind(user.id).all();
    else if (hasRole(user, "manager", "admin", "secretary", "support")) result = await env.DB.prepare("SELECT * FROM training_requests ORDER BY created_at DESC LIMIT 200").all();
    else return errorResponse("forbidden", 403, headers);
    return response({ requests: result.results }, 200, headers);
  }
  const requestMatch = path.match(/^\/api\/training-requests\/([^/]+)$/);
  if (requestMatch && request.method === "PATCH") {
    if (!hasRole(user, "coach", "manager", "admin")) return errorResponse("forbidden", 403, headers);
    const item = await env.DB.prepare("SELECT * FROM training_requests WHERE id=?").bind(requestMatch[1]).first();
    if (!item) return errorResponse("training_request_not_found", 404, headers);
    const body = await jsonBody(request, 8192);
    if (hasRole(user, "coach") && item.coach_id && item.coach_id !== user.id) return errorResponse("not_assigned_coach", 403, headers);
    const status = String(body.status || item.status);
    if (!REQUEST_STATUSES.has(status)) return errorResponse("invalid_status", 400, headers);
    const coachId = hasRole(user, "coach") ? user.id : body.coachId || item.coach_id;
    await env.DB.prepare("UPDATE training_requests SET coach_id=?,status=?,updated_at=datetime('now'),completed_at=CASE WHEN ?='completed' THEN datetime('now') ELSE completed_at END WHERE id=?").bind(coachId || null, status, status, item.id).run();
    await audit(env, user.id, "training_request_updated", "training_request", item.id, { status, coachId: coachId || null });
    return response({ ok: true }, 200, headers);
  }
  if (path === "/api/training-deliverables" && request.method === "POST") {
    if (!hasRole(user, "coach", "manager", "admin")) return errorResponse("forbidden", 403, headers);
    const body = await jsonBody(request, 20000);
    const title = String(body.title || "").trim();
    if (!body.requestId || !title) return errorResponse("request_id_and_title_required", 400, headers);
    const item = await env.DB.prepare("SELECT * FROM training_requests WHERE id=?").bind(body.requestId).first();
    if (!item) return errorResponse("training_request_not_found", 404, headers);
    if (hasRole(user, "coach") && item.coach_id && item.coach_id !== user.id) return errorResponse("not_assigned_coach", 403, headers);
    const deliverableId = makeId("deliverable");
    await env.DB.batch([
      env.DB.prepare("INSERT INTO training_deliverables (id,request_id,coach_id,title,body,file_key,version,sent_at) VALUES (?,?,?,?,?,?,?,datetime('now'))").bind(deliverableId, item.id, user.id, title, body.body || null, body.fileKey || null, Number(body.version || 1)),
      env.DB.prepare("UPDATE training_requests SET coach_id=COALESCE(coach_id,?),status='completed',completed_at=datetime('now'),updated_at=datetime('now') WHERE id=?").bind(user.id, item.id),
    ]);
    await audit(env, user.id, "training_deliverable_created", "training_deliverable", deliverableId, { requestId: item.id });
    return response({ ok: true, deliverableId }, 201, headers);
  }
  if (path === "/api/entry-requests" && request.method === "POST") {
    if (!hasRole(user, "athlete")) return errorResponse("athlete_only", 403, headers);
    const existing = await env.DB.prepare("SELECT * FROM entry_requests WHERE user_id=? AND status IN ('pending','approved') ORDER BY created_at DESC LIMIT 1").bind(user.id).first();
    if (existing) return response({ ok: true, duplicate: true, entryRequest: existing }, 200, headers);
    const entryId = makeId("entry");
    try {
      await env.DB.prepare("INSERT INTO entry_requests (id,user_id) VALUES (?,?)").bind(entryId, user.id).run();
    } catch (e) {
      const retry = await env.DB.prepare("SELECT * FROM entry_requests WHERE user_id=? AND status IN ('pending','approved') ORDER BY created_at DESC LIMIT 1").bind(user.id).first();
      if (retry) return response({ ok: true, duplicate: true, entryRequest: retry }, 200, headers);
      throw e;
    }
    await audit(env, user.id, "entry_request_created", "entry_request", entryId, {});
    return response({ ok: true, entryRequest: await env.DB.prepare("SELECT * FROM entry_requests WHERE id=?").bind(entryId).first() }, 201, headers);
  }
  if (path === "/api/entry-requests" && request.method === "GET") {
    if (hasRole(user, "athlete")) {
      const result = await env.DB.prepare("SELECT * FROM entry_requests WHERE user_id=? ORDER BY created_at DESC LIMIT 50").bind(user.id).all();
      return response({ entryRequests: result.results }, 200, headers);
    }
    if (!hasRole(user, "manager", "admin", "secretary")) return errorResponse("forbidden", 403, headers);
    const result = await env.DB.prepare("SELECT e.*,u.full_name,u.phone FROM entry_requests e JOIN users u ON u.id=e.user_id ORDER BY e.created_at DESC LIMIT 200").all();
    return response({ entryRequests: result.results }, 200, headers);
  }
  const entryMatch = path.match(/^\/api\/entry-requests\/([^/]+)$/);
  if (entryMatch && request.method === "PATCH") {
    if (!hasRole(user, "manager", "admin", "secretary")) return errorResponse("forbidden", 403, headers);
    const body = await jsonBody(request, 2048);
    const status = String(body.status || "");
    if (!ENTRY_STATUSES.has(status)) return errorResponse("invalid_status", 400, headers);
    const result = await env.DB.prepare("UPDATE entry_requests SET status=?,reviewed_by=?,reviewed_at=datetime('now'),exited_at=CASE WHEN ?='exited' THEN datetime('now') ELSE exited_at END WHERE id=?").bind(status, user.id, status, entryMatch[1]).run();
    if (!result.meta || result.meta.changes !== 1) return errorResponse("entry_request_not_found", 404, headers);
    await audit(env, user.id, "entry_request_updated", "entry_request", entryMatch[1], { status });
    return response({ ok: true }, 200, headers);
  }
  if (path === "/api/coach/programs" && request.method === "GET") {
    if (!hasRole(user, "coach")) return errorResponse("forbidden", 403, headers);
    const result = await env.DB.prepare("SELECT * FROM coach_programs WHERE coach_id=? AND is_active=1 ORDER BY updated_at DESC LIMIT 100").bind(user.id).all();
    return response({ programs: result.results }, 200, headers);
  }
  if (path === "/api/coach/programs" && request.method === "POST") {
    if (!hasRole(user, "coach")) return errorResponse("forbidden", 403, headers);
    const body = await jsonBody(request, 20000);
    const title = String(body.title || "").trim();
    const kind = String(body.kind || "training");
    const content = typeof body.body === "string" ? body.body : JSON.stringify(body.body || {});
    if (!title || !PROGRAM_KINDS.has(kind) || content.length > 15000) return errorResponse("invalid_program", 400, headers);
    const programId = makeId("program");
    await env.DB.prepare("INSERT INTO coach_programs (id,coach_id,title,kind,body) VALUES (?,?,?,?,?)").bind(programId, user.id, title, kind, content).run();
    return response({ ok: true, program: await env.DB.prepare("SELECT * FROM coach_programs WHERE id=?").bind(programId).first() }, 201, headers);
  }
  const programMatch = path.match(/^\/api\/coach\/programs\/([^/]+)$/);
  if (programMatch && request.method === "PATCH") {
    if (!hasRole(user, "coach")) return errorResponse("forbidden", 403, headers);
    const body = await jsonBody(request, 20000);
    const program = await env.DB.prepare("SELECT * FROM coach_programs WHERE id=? AND coach_id=?").bind(programMatch[1], user.id).first();
    if (!program) return errorResponse("program_not_found", 404, headers);
    const title = body.title === undefined ? program.title : String(body.title).trim();
    const content = body.body === undefined ? program.body : typeof body.body === "string" ? body.body : JSON.stringify(body.body);
    await env.DB.prepare("UPDATE coach_programs SET title=?,body=?,is_active=?,updated_at=datetime('now') WHERE id=? AND coach_id=?").bind(title, content, body.isActive === undefined ? program.is_active : body.isActive ? 1 : 0, program.id, user.id).run();
    return response({ ok: true }, 200, headers);
  }
  if (path === "/api/messages" && request.method === "GET") {
    const result = await env.DB.prepare("SELECT m.*,s.full_name AS sender_name,r.full_name AS recipient_name FROM club_messages m JOIN users s ON s.id=m.sender_id JOIN users r ON r.id=m.recipient_id WHERE m.sender_id=? OR m.recipient_id=? ORDER BY m.created_at DESC LIMIT 200").bind(user.id, user.id).all();
    return response({ messages: result.results }, 200, headers);
  }
  if (path === "/api/messages" && request.method === "POST") {
    const body = await jsonBody(request, 8192);
    const message = String(body.body || "").trim();
    if (!message || message.length > 4000) return errorResponse("message_required", 400, headers);
    let recipientId = String(body.recipientId || "");
    if (!recipientId && hasRole(user, "athlete")) {
      const coach = await env.DB.prepare("SELECT coach_id FROM training_requests WHERE user_id=? AND coach_id IS NOT NULL ORDER BY updated_at DESC LIMIT 1").bind(user.id).first();
      recipientId = coach?.coach_id || "";
    }
    if (!recipientId) return errorResponse("recipient_required", 400, headers);
    const recipient = await userById(env, recipientId);
    if (!recipient || recipient.status !== "active") return errorResponse("recipient_not_found", 404, headers);
    if (hasRole(user, "athlete") && !hasRole(recipient, "coach", "manager", "support")) return errorResponse("invalid_recipient", 403, headers);
    if (hasRole(user, "coach") && !hasRole(recipient, "athlete", "manager", "support")) return errorResponse("invalid_recipient", 403, headers);
    const messageId = makeId("msg");
    await env.DB.prepare("INSERT INTO club_messages (id,sender_id,recipient_id,body) VALUES (?,?,?,?)").bind(messageId, user.id, recipient.id, message).run();
    return response({ ok: true, messageId }, 201, headers);
  }
  if (path === "/api/admin/users" && request.method === "GET") {
    if (!hasRole(user, "manager", "support")) return errorResponse("forbidden", 403, headers);
    const page = Math.max(1, Math.min(100000, Number(new URL(request.url).searchParams.get("page")) || 1));
    const result = await env.DB.prepare("SELECT u.id,u.full_name,u.phone,u.email,u.status,u.created_at,COALESCE(a.role,ur.role,u.role) AS role,COALESCE(a.state,CASE WHEN COALESCE(ur.role,u.role)='athlete' THEN 'approved' ELSE 'pending' END) AS access_state,c.name AS club_name FROM users u LEFT JOIN account_access a ON a.user_id=u.id LEFT JOIN user_roles ur ON ur.user_id=u.id LEFT JOIN clubs c ON c.id=a.club_id ORDER BY u.created_at DESC,u.id LIMIT 100 OFFSET ?").bind((Math.floor(page) - 1) * 100).all();
    const total = (await env.DB.prepare("SELECT COUNT(*) AS count FROM users").first()).count;
    return response({ users: await deviceStatesForUsers(env,user,hasRole,result.results), total, page: Math.floor(page), pageSize: 100 }, 200, headers);
  }
  const userMatch = path.match(/^\/api\/admin\/users\/([^/]+)$/);
  if (userMatch && request.method === "PATCH") {
    if (!hasRole(user, "support")) return errorResponse("forbidden", 403, headers);
    const target = await userById(env, userMatch[1]);
    if (!target) return errorResponse("user_not_found", 404, headers);
    const body = await jsonBody(request, 4096);
    if (body.role !== undefined && body.role !== roleOf(target)) return errorResponse("use_role_approval_workflow", 403, headers);
    if (target.phone === SUPPORT_PHONE || hasRole(target, "manager")) return errorResponse("protected_account", 403, headers);
    const role = roleOf(target);
    const status = body.status === undefined ? target.status : String(body.status);
    if (!ROLES.has(role) || !USER_STATUSES.has(status)) return errorResponse("invalid_user_update", 400, headers);
    const legacyRole = ["athlete", "coach", "manager", "admin"].includes(role) ? role : "athlete";
    await env.DB.batch([
      env.DB.prepare("UPDATE users SET role=?,status=?,full_name=COALESCE(?,full_name),updated_at=datetime('now') WHERE id=?").bind(legacyRole, status, body.fullName || null, target.id),
      env.DB.prepare("INSERT INTO user_roles (user_id,role) VALUES (?,?) ON CONFLICT(user_id) DO UPDATE SET role=excluded.role").bind(target.id, role),
    ]);
    await audit(env, user.id, "user_updated", "user", target.id, { role, status });
    return response({ ok: true, user: publicUser(await userById(env, target.id)) }, 200, headers);
  }
  return errorResponse("not_found", 404, headers);
}

export default {
  async fetch(request, env) {
    try {
      return await handle(request, env);
    } catch (error) {
      if (!error.status || error.status >= 500) console.error("MG FitClub API error", error);
      return response({ error: error.status ? error.message : "internal_error" }, error.status || 500, cors(request, env));
    }
  },
};
