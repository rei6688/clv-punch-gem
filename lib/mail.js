const { Resend } = require('resend');

// Để sử dụng, bạn cần thêm RESEND_API_KEY vào .env.local
// Lấy key free tại: https://resend.com/
const resend = new Resend(process.env.RESEND_API_KEY || 're_123');

/**
 * Gửi email thông báo
 * @param {Object} params
 * @param {string} params.to - Email người nhận
 * @param {string} params.subject - Tiêu đề
 * @param {string} params.html - Nội dung HTML
 */
async function sendEmail({ to, subject, html }) {
    if (!process.env.RESEND_API_KEY) {
        console.warn('⚠️ RESEND_API_KEY không tồn tại. Bỏ qua gửi email.');
        return null;
    }

    try {
        const data = await resend.emails.send({
            from: 'Auto Punch <onboarding@resend.dev>', // Resend cho phép dùng domain này để test
            to: [to || process.env.NOTIFICATION_EMAIL || 'namthanhnguyen@cyberlogitec.com.vn'],
            subject: subject,
            html: html,
        });
        console.log('✅ Email sent:', data.id);
        return data;
    } catch (error) {
        console.error('❌ Failed to send email:', error);
        return null;
    }
}

module.exports = { sendEmail };
