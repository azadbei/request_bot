const { Telegraf } = require('telegraf');
const fs = require('fs');
const path = require('path');
const http = require('http');

const token = '9154919587:AAEta__W6G-sUa62R-EpA1HHr1FES-IlE84';
const GROUP_ID = '-1002648012307'; 
const PUBLIC_CHANNEL = '@BENBY';
const PRIVATE_CHANNEL_LINK = 'https://t.me/+o3h2rDKD0NE2NDk6';

const bot = new Telegraf(token);

const dataFile = path.join(__dirname, 'requestedUsers.json');
let requestedUsers = new Set();

// Yuborilgan ogohlantirish xabarlari ID larini saqlash uchun
const warningMessages = new Map();

if (fs.existsSync(dataFile)) {
    const rawData = fs.readFileSync(dataFile);
    requestedUsers = new Set(JSON.parse(rawData));
}

function saveRequestedUsers() {
    fs.writeFileSync(dataFile, JSON.stringify(Array.from(requestedUsers)));
}

async function checkAndUnmute(userId) {
    try {
        const member = await bot.telegram.getChatMember(PUBLIC_CHANNEL, userId);
        const inPublicChannel = ['member', 'administrator', 'creator'].includes(member.status);
        const requestedPrivate = requestedUsers.has(userId);

        if (inPublicChannel && requestedPrivate) {
            // Shartlar bajarildi, yozishga ruxsat beramiz
            await bot.telegram.restrictChatMember(GROUP_ID, userId, {
                can_send_messages: true,
                can_send_audios: true,
                can_send_documents: true,
                can_send_photos: true,
                can_send_videos: true,
                can_send_video_notes: true,
                can_send_voice_notes: true,
                can_send_polls: true,
                can_send_other_messages: true,
                can_add_web_page_previews: true
            });

            // Agar ogohlantirish xabari guruhga yuborilgan bo'lsa, uni o'chiramiz
            if (warningMessages.has(userId)) {
                try {
                    await bot.telegram.deleteMessage(GROUP_ID, warningMessages.get(userId));
                    warningMessages.delete(userId); // O'chirilgach, xotiradan tozalaymiz
                } catch (e) {
                    console.log("Xabarni o'chirishda xatolik:", e);
                }
            }
            return true;
        } else {
            // Shartlar bajarilmadi, yozishni cheklaymiz
            await bot.telegram.restrictChatMember(GROUP_ID, userId, {
                can_send_messages: false
            });
            return false;
        }
    } catch (error) {
        console.error("Tekshirishda xatolik:", error);
        return false;
    }
}

bot.on('chat_join_request', async (ctx) => {
    const userId = ctx.from.id;
    requestedUsers.add(userId);
    saveRequestedUsers();
    await checkAndUnmute(userId);
});

bot.on('chat_member', async (ctx) => {
    if (ctx.chat.username && ctx.chat.username.toLowerCase() === PUBLIC_CHANNEL.replace('@', '').toLowerCase()) {
        const user = ctx.update.chat_member.user;
        const userId = user.id;
        const newStatus = ctx.update.chat_member.new_chat_member.status;

        const isAllowed = await checkAndUnmute(userId);

        if (!isAllowed && ['left', 'kicked'].includes(newStatus)) {
            try {
                // Kanaldan chiqqani haqida ogohlantirish va uning ID sini saqlash
                const sentMsg = await bot.telegram.sendMessage(GROUP_ID, `⚠️ [${user.first_name}](tg://user?id=${userId}), siz ommaviy kanaldan chiqqaningiz sababli guruhda yozish huquqidan mahrum bo'ldingiz!\n\nQayta yozish ruxsatini olish uchun obunani yangilang:\n1️⃣ ${PUBLIC_CHANNEL}\n2️⃣ ${PRIVATE_CHANNEL_LINK}`, { parse_mode: 'Markdown' });
                warningMessages.set(userId, sentMsg.message_id);
            } catch (e) {
                console.log("Xabar yuborishda xato");
            }
        }
    }
});

bot.on('new_chat_members', async (ctx) => {
    if (ctx.chat.id == GROUP_ID) {
        for (let user of ctx.message.new_chat_members) {
            try {
                const isAllowed = await checkAndUnmute(user.id);
                if (!isAllowed) {
                    // Yangi a'zoga shartlarni tashlash va xabar ID sini saqlash
                    const sentMsg = await ctx.replyWithMarkdown(`Salom [${user.first_name}](tg://user?id=${user.id})!\n\nGuruhda yozish ruxsatini olish uchun quyidagi shartlarni bajaring:\n\n1️⃣ Ommaviy kanalga qo'shiling: ${PUBLIC_CHANNEL}\n2️⃣ Yopiq kanalga zayavka tashlang: ${PRIVATE_CHANNEL_LINK}`);
                    warningMessages.set(user.id, sentMsg.message_id);
                }
            } catch (err) {
                console.log("A'zoni cheklashda xatolik:", err);
            }
        }
    }
});

// --- RENDER BЕPUL TARIFI UCHUN MAXSUS SERVER ---
const server = http.createServer((req, res) => {
    res.writeHead(200);
    res.end("Bot aktiv holatda!");
});
server.listen(process.env.PORT || 3000, () => {
    console.log("Web server ishga tushdi...");
});
// -----------------------------------------------

bot.launch({
    allowedUpdates: ['message', 'chat_member', 'chat_join_request']
}).then(() => {
    console.log("✅ Telegraf bot muvaffaqiyatli ishga tushdi!");
});

process.once('SIGINT', () => { bot.stop('SIGINT'); server.close(); });
process.once('SIGTERM', () => { bot.stop('SIGTERM'); server.close(); });

