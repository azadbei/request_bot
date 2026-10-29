const { Telegraf } = require('telegraf');
const fs = require('fs');
const path = require('path');
const http = require('http'); // Render uchun qo'shildi

const token = '9154919587:AAEta__W6G-sUa62R-EpA1HHr1FES-IlE84';
const GROUP_ID = '-1002648012307'; 
const PUBLIC_CHANNEL = '@BENBY';
const PRIVATE_CHANNEL_LINK = 'https://t.me/+o3h2rDKD0NE2NDk6';

const bot = new Telegraf(token);

const dataFile = path.join(__dirname, 'requestedUsers.json');
let requestedUsers = new Set();

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
            return true;
        }
        return false;
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
        const userId = ctx.from.id;
        await checkAndUnmute(userId);
    }
});

bot.on('new_chat_members', async (ctx) => {
    if (ctx.chat.id == GROUP_ID) {
        for (let user of ctx.message.new_chat_members) {
            try {
                await bot.telegram.restrictChatMember(GROUP_ID, user.id, {
                    can_send_messages: false
                });
                await ctx.replyWithMarkdown(`Salom [${user.first_name}](tg://user?id=${user.id})!\n\nGuruhda yozish ruxsatini olish uchun quyidagi shartlarni bajaring:\n\n1️⃣ Ommaviy kanalga qo'shiling: ${PUBLIC_CHANNEL}\n2️⃣ Yopiq kanalga zayavka tashlang: ${PRIVATE_CHANNEL_LINK}`);
            } catch (err) {
                console.log("Cheklashda xatolik:", err);
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
