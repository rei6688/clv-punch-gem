// File: api/cron-check-wfh.js

const { Octokit } = require('@octokit/rest');
const { kv } = require('@vercel/kv');
const { sendChat } = require('../lib/chat');
const { getVietnamDateKey } = require('../lib/time');

// Xác thực (Bí mật của Cron)
const punchSecret = process.env.PUNCH_SECRET || 'Thanhnam0';
// Xác thực (Bí mật để gọi GHA)
const githubPat = process.env.GITHUB_PAT;

// Thông tin Repo (Cần thay đổi nếu tên repo hoặc user thay đổi)
const GHA_OWNER = 'rei6868';
const GHA_REPO = 'clv-punch-gem';
const GHA_WORKFLOW_ID = 'wfh-punch.yml';

/**
* Xác thực request từ Cron
*/
function authenticate(req) {
const auth = req.headers.authorization || '';
const token = auth.replace(/^Bearer\s+/, '');
if (token !== punchSecret) throw new Error('invalid cron secret');
}

/**
* Dùng Octokit và GITHUB_PAT để trigger GHA workflow_dispatch
*/
async function triggerGitHubWorkflow() {
if (!githubPat) {
throw new Error('GITHUB_PAT is not configured on Vercel.');
}

const octokit = new Octokit({ auth: githubPat });

try {
await octokit.actions.createWorkflowDispatch({
owner: GHA_OWNER,
repo: GHA_REPO,
workflow_id: GHA_WORKFLOW_ID,
ref: 'main',
});
console.log(`Successfully triggered workflow (PM): ${GHA_WORKFLOW_ID}`);
return true;
} catch (error) {
console.error(`Failed to trigger workflow (PM): ${error.message}`);
if (error.status === 404) {
throw new Error(`Workflow file '${GHA_WORKFLOW_ID}' not found or PAT has wrong permissions.`);
}
throw error;
}
}

/**
* Lấy cờ override từ Vercel KV
*/
async function getWfhOverride(dateKey) {
const key = `punch:day:${dateKey}:wfh_override`;
return kv.get(key);
}

/**
* Xóa cờ override khỏi Vercel KV
*/
async function clearWfhOverride(dateKey) {
const key = `punch:day:${dateKey}:wfh_override`;
return kv.del(key);
}


module.exports = async function handler(req, res) {
const rid = req.headers['x-vercel-id'] || Date.now().toString();
const ok = (data = {}) => res.status(200).json({ ok: true, requestId: rid, ...data });
const bad = (code, msg) => res.status(code).json({ ok: false, error: msg, requestId: rid });

if (req.method !== 'POST') {
res.setHeader('Allow', 'POST');
return bad(405, 'method not allowed');
}

try {
// 1. Xác thực request (từ GHA Cron)
authenticate(req);

const dateKey = getVietnamDateKey();

// 2. Kiểm tra cờ override
const isOverride = await getWfhOverride(dateKey);

if (!isOverride) {
// Đây là ngày bình thường, không có override WFH
return ok({ message: 'Skipped: No WFH override flag set.' });
}

// 3. Nếu CÓ override, kích hoạt GHA (Punch Out)
await triggerGitHubWorkflow();

// 4. Xóa cờ (để không chạy lại)
await clearWfhOverride(dateKey);

// 5. Gửi thông báo (Chỉ báo lỗi, không báo thành công)
console.log(`Successfully triggered WFH Override PM punch for ${dateKey}`);

// 6. Trả về kết quả
return ok({ triggered_pm_punch: true });

} catch (e) {
const msg = (e && e.message) || 'unknown error';
if (msg.includes('secret')) return bad(403, msg);
// Gửi thông báo nếu LỖI
await sendChat({ title: '🚨 LỖI Kích hoạt WFH (PM)', message: msg, icon: 'failure' });
return bad(500, 'server error', { detail: msg });
}
}
