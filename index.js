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

// Xabar ID lari faqat bot xotirasida saqlanadi (hech qanday fayl talab qilinmaydi)
let warningMessages = {};

// Asosiy bazani xavfsiz o'qish
if (fs.existsSync(dataFile)) {
    try {
        requestedUsers = new Set(JSON.parse(fs.readFileSync(dataFile)));
    } catch (e) {
        console.log("Bazani o'qishda xatolik, yangidan boshlanmoqda...");
    }
}

function saveRequestedUsers() {
    try {
        fs.writeFileSync(dataFile, JSON.stringify(Array.from(requestedUsers)));
    } catch (e) {}
}

async function checkAndUnmute(userId) {
    try {
        const member = await bot.telegram.getChatMember(PUBLIC_CHANNEL, userId);
        const inPublicChannel = ['member', 'administrator', 'creator'].includes(member.status);
        const requestedPrivate = requestedUsers.has(userId);

        if (inPublicChannel && requestedPrivate) {
            // Ruxsat berish
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

            // Xabarni guruhdan o'chirish
            if (warningMessages[userId]) {
                try {
                    await bot.telegram.deleteMessage(GROUP_ID, warningMessages[userId]);
                    delete warningMessages[userId]; // O'chirilgach xotiradan tozalash
                } catch (e) {
                    console.log("O'chirishda xato:", e.description || e);
                }
            }
            return true;
        } else {
            // Ruxsatni olish
            await bot.telegram.restrictChatMember(GROUP_ID, userId, { can_send_messages: false });
            return false;
        }
    } catch (error) {
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
                const sentMsg = await bot.telegram.sendMessage(GROUP_ID, `⚠️ [${user.first_name}](tg://user?id=${userId}), siz ommaviy kanaldan chiqqaningiz sababli guruhda yozish huquqidan mahrum bo'ldingiz!\n\nQayta yozish ruxsatini olish uchun obunani yangilang:\n1️⃣ ${PUBLIC_CHANNEL}\n2️⃣ ${PRIVATE_CHANNEL_LINK}`, { parse_mode: 'Markdown' });
                warningMessages[userId] = sentMsg.message_id; // Xotiraga saqlash
            } catch (e) {}
        }
    }
});

bot.on('new_chat_members', async (ctx) => {
    if (ctx.chat.id == GROUP_ID) {
        for (let user of ctx.message.new_chat_members) {
            try {
                const isAllowed = await checkAndUnmute(user.id);
                if (!isAllowed) {
                    const sentMsg = await ctx.replyWithMarkdown(`Salom [${user.first_name}](tg://user?id=${user.id})!\n\nGuruhda yozish ruxsatini olish uchun quyidagi shartlarni bajaring:\n\n1️⃣ Ommaviy kanalga qo'shiling: ${PUBLIC_CHANNEL}\n2️⃣ Yopiq kanalga zayavka tashlang: ${PRIVATE_CHANNEL_LINK}`);
                    warningMessages[user.id] = sentMsg.message_id; // Xotiraga saqlash
                }
            } catch (err) {}
        }
    }
});

// --- RENDER SERVER ---
const server = http.createServer((req, res) => {
    res.writeHead(200);
    res.end("Bot aktiv!");
});
server.listen(process.env.PORT || 3000);
// ---------------------

bot.launch({
    allowedUpdates: ['message', 'chat_member', 'chat_join_request']
}).then(() => console.log("✅ Bot ishga tushdi!"));

process.once('SIGINT', () => { bot.stop('SIGINT'); server.close(); });
process.once('SIGTERM', () => { bot.stop('SIGTERM'); server.close(); });
