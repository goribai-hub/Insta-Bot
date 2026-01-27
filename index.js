let InstagramChatAPI;
let bot;

const config = require('./config.json');
const pkg = require('./package.json');
const fs = require('fs');
const path = require('path');
const { dbHelpers } = require('./database');

const botStartTime = Date.now();
let language = {};

function loadLanguage() {
    try {
        const langPath = path.join(__dirname, 'languages', `${config.language || 'en'}.json`);
        if (fs.existsSync(langPath)) {
            language = JSON.parse(fs.readFileSync(langPath, 'utf8'));
            logger.success(`Loaded language: ${config.language || 'en'}`);
        } else {
            logger.warn(`Language file not found: ${langPath}. Using defaults.`);
        }
    } catch (e) {
        logger.error(`Error loading language: ${e.message}`);
    }
}

function getText(key, ...args) {
    let text = language[key] || key;
    args.forEach(arg => {
        text = text.replace('%s', arg);
    });
    return text;
}

const colors = {
    reset: '\x1b[0m',
    bright: '\x1b[1m',
    dim: '\x1b[2m',
    red: '\x1b[31m',
    green: '\x1b[32m',
    yellow: '\x1b[33m',
    blue: '\x1b[34m',
    magenta: '\x1b[35m',
    cyan: '\x1b[36m',
    white: '\x1b[37m',
    pink: '\x1b[38;5;206m',
    orange: '\x1b[38;5;208m',
    bgRed: '\x1b[41m',
    bgGreen: '\x1b[42m',
    bgYellow: '\x1b[43m',
    bgBlue: '\x1b[44m',
    bgMagenta: '\x1b[45m',
    bgCyan: '\x1b[46m'
};

const titles = [
    [
        `${colors.cyan}███╗   ███╗███████╗██╗  ██╗███████╗██████╗  █████╗ ███████╗${colors.reset}`,
        `${colors.cyan}████╗ ████║██╔════╝██║  ██║██╔════╝██╔══██╗██╔══██╗╚══███╔╝${colors.reset}`,
        `${colors.cyan}██╔████╔██║█████╗  ███████║█████╗  ██████╔╝███████║  ███╔╝ ${colors.reset}`,
        `${colors.cyan}██║╚██╔╝██║██╔══╝  ██╔══██║██╔══╝  ██╔══██╗██╔══██║ ███╔╝  ${colors.reset}`,
        `${colors.cyan}██║ ╚═╝ ██║███████╗██║  ██║███████╗██║  ██║██║  ██║███████╗${colors.reset}`,
        `${colors.cyan}╚═╝     ╚═╝╚══════╝╚═╝  ╚═╝╚══════╝╚═╝  ╚═╝╚═╝  ╚═╝╚══════╝${colors.reset}`,
        `${colors.pink}██╗ ██████╗${colors.reset}`,
        `${colors.pink}██║██╔════╝${colors.reset}`,
        `${colors.pink}██║██║  ███╗${colors.reset}`,
        `${colors.pink}██║██║   ██║${colors.reset}`,
        `${colors.pink}██║╚██████╔╝${colors.reset}`,
        `${colors.pink}╚═╝ ╚═════╝ ${colors.reset}`

    ],
    [
        `${colors.cyan}███████╗${colors.cyan}██╗${colors.cyan}██╗${colors.reset}`,
        `${colors.cyan}██╔════╝${colors.cyan}██║${colors.cyan}██║${colors.reset}`,
        `${colors.pink}MEHERAZ IG${colors.reset}`
    ]
];

const logger = {
    info: (msg) => console.log(`${colors.cyan}[INFO]${colors.reset} ${colors.dim}${new Date().toLocaleString()}${colors.reset} - ${msg}`),
    error: (msg) => console.error(`${colors.red}[ERROR]${colors.reset} ${colors.dim}${new Date().toLocaleString()}${colors.reset} - ${colors.red}${msg}${colors.reset}`),
    success: (msg) => console.log(`${colors.green}[SUCCESS]${colors.reset} ${colors.dim}${new Date().toLocaleString()}${colors.reset} - ${colors.green}${msg}${colors.reset}`),
    warn: (msg) => console.warn(`${colors.yellow}[WARN]${colors.reset} ${colors.dim}${new Date().toLocaleString()}${colors.reset} - ${colors.yellow}${msg}${colors.reset}`),
    command: (msg) => console.log(`${colors.magenta}[COMMAND]${colors.reset} ${colors.dim}${new Date().toLocaleString()}${colors.reset} - ${colors.magenta}${msg}${colors.reset}`),
    status: (msg) => console.log(`${colors.blue}[STATUS]${colors.reset} ${msg}`),
    event: (msg) => console.log(`${colors.pink}[EVENT]${colors.reset} ${colors.dim}${new Date().toLocaleString()}${colors.reset} - ${colors.pink}${msg}${colors.reset}`)
};

const originalLog = console.log;
const originalWarn = console.warn;
const originalError = console.error;

const hideAndFilter = (args) => {
    return args.map(arg => {
        if (typeof arg === 'string') {
            const noise = ['502 Bad Gateway', '504 Gateway Timeout', 'suggested_searches', 'Invalid cookie file', 'login_required'];
            if (noise.some(n => arg.includes(n))) return null;
            return arg.replace(/neokex-ica/g, config.botName || 'VERO BOT');
        }
        return arg;
    }).filter(a => a !== null);
};

console.log = (...args) => { const f = hideAndFilter(args); if (f.length) originalLog.apply(console, f); };
console.warn = (...args) => { const f = hideAndFilter(args); if (f.length) originalWarn.apply(console, f); };
console.error = (...args) => { const f = hideAndFilter(args); if (f.length) originalError.apply(console, f); };

let isLoggedIn = false;
let commandModules = {
    startarc: new Map(),
    replyarc: new Map(),
    noprefixarc: new Map()
};

class MessageHandler {
    constructor(threadId, itemId) {
        this.threadId = threadId;
        this.itemId = itemId;
    }

    async send(message) {
        try {
            logger.info(`Sending message...`);
            return await bot.dm.sendMessage(this.threadId, message);
        } catch (error) {
            logger.error(`Send failed: ${error.message}`);
            throw error;
        }
    }

    async reply(message) {
        try {
            logger.info(`Replying...`);
            return await bot.dm.sendMessage(this.threadId, message, { replyToItemId: this.itemId });
        } catch (error) {
            logger.error(`Reply failed: ${error.message}`);
            throw error;
        }
    }

    async react(emoji) {
        try {
            return await bot.dm.sendReaction(this.threadId, this.itemId, emoji || '❤️');
        } catch (error) {
            logger.error(`Reaction failed: ${error.message}`);
            throw error;
        }
    }

    async sendAttachment(filePath, type = 'photo') {
        try {
            logger.info(`Sending ${type}...`);
            if (type === 'photo') {
                return await bot.dm.sendPhoto(this.threadId, filePath);
            } else if (type === 'video') {
                return await bot.dm.sendVideo(this.threadId, filePath);
            }
        } catch (error) {
            logger.error(`Attachment failed: ${error.message}`);
            throw error;
        }
    }

    async unsend(itemId) {
        try {
            logger.info(`Unsending message ${itemId}...`);
            return await bot.dm.unsendMessage(this.threadId, itemId);
        } catch (error) {
            logger.error(`Unsend failed: ${error.message}`);
            throw error;
        }
    }
}

function loadCommands() {
    const commandsDir = path.join(__dirname, 'commands');
    if (!fs.existsSync(commandsDir)) return;

    const getAllFiles = (dir) => {
        let results = [];
        const list = fs.readdirSync(dir);
        list.forEach(file => {
            file = path.join(dir, file);
            const stat = fs.statSync(file);
            if (stat && stat.isDirectory()) results = results.concat(getAllFiles(file));
            else if (file.endsWith('.js')) results.push(file);
        });
        return results;
    }

    const files = getAllFiles(commandsDir);
    for (const file of files) {
        try {
            delete require.cache[require.resolve(file)];
            const cmd = require(file);
            const types = Array.isArray(cmd.type) ? cmd.type : [cmd.type];

            types.forEach(type => {
                if (type === 'startarc' && cmd.name) {
                    commandModules.startarc.set(cmd.name.toLowerCase(), cmd);
                    logger.success(`Loaded [STARTARC]: ${cmd.name}`);
                }
                if (type === 'replyarc' && cmd.name) {
                    commandModules.replyarc.set(cmd.name.toLowerCase(), cmd);
                    logger.success(`Loaded [REPLYARC]: ${cmd.name}`);
                }
                if (type === 'noprefixarc') {
                    const fileName = path.basename(file);
                    commandModules.noprefixarc.set(fileName, cmd);
                    logger.success(`Loaded [NOPREFIX]: ${fileName}`);
                }
            });
        } catch (e) {
            logger.error(`Failed to load ${file}: ${e.message}`);
        }
    }
    logger.success(`Total ${files.length} command files active.`);
}

async function processMessage(event, threadId) {
    try {
        const text = (event.text || '').trim();
        const handler = new MessageHandler(threadId, event.item_id);

        for (const [, cmd] of commandModules.noprefixarc) {
            try {
                const handlerFunc = cmd.onNoPrefix || cmd.execute;
                if (handlerFunc && await handlerFunc({ text, message: event, handler, config, getText, bot, commandModules }) === true) return;
            } catch (e) { logger.error(`Noprefix error: ${e.message}`); }
        }

        if (text.startsWith(config.prefix)) {
            const args = text.slice(config.prefix.length).trim().split(/ +/);
            const name = args.shift()?.toLowerCase();

            let cmd = event.messageReply ? commandModules.replyarc.get(name) : commandModules.startarc.get(name);
            if (!cmd) cmd = commandModules.startarc.get(name);

            if (cmd) {
                const handlerFunc = event.messageReply ? (cmd.onReply || cmd.execute) : (cmd.onStart || cmd.execute);

                if (handlerFunc) {
                    const senderId = (event.user_id || event.message?.user_id)?.toString();
                    const senderName = event.username || 'unknown';

                    if (cmd.role === 'admin') {
                        const isAdmin = config.admin.includes(senderName) || config.admin.includes(senderId);
                        if (!isAdmin) {
                            logger.warn(`Unauthorized access attempt by @${senderName} (${senderId}) for command: ${name}`);
                            await handler.reply(getText('notAdmin'));
                            return;
                        }
                    }

                    await handlerFunc({ args, message: event, handler, config, getText, bot, commandModules });
                }
            } else {
                const senderName = event.username || 'unknown';
                logger.command(`Unknown command attempt: ${config.prefix}${name} from @${senderName}`);
            }
        }
    } catch (e) {
        logger.error(`Process error: ${e.message}`);
    }
}

async function login() {
    try {
        if (!bot) {
            const module = await import('neokex-ica');
            bot = new module.default({ showBanner: false });
        }

        const ig = bot.getIgClient();
        const sessionPath = path.join(__dirname, 'data', 'session.json');
        const cookiePath = path.join(__dirname, 'cookies.txt');

        async function validate(type) {
            try {
                const user = await Promise.race([
                    ig.account.currentUser(),
                    new Promise((_, j) => setTimeout(() => j(new Error('Timeout')), 10000))
                ]);
                bot.userId = user.pk.toString();
                bot.username = user.username;
                bot.isLoggedIn = true;
                isLoggedIn = true;
                logger.success(`Login via ${type}: @${user.username}`);
                return true;
            } catch (e) { return false; }
        }

        if (config.instagram.cookies && config.instagram.cookies.includes('sessionid')) {
            const pairs = config.instagram.cookies.split(';').map(v => v.trim()).filter(v => v.length > 0);
            for (const p of pairs) {
                const [n, ...v] = p.split('=');
                await ig.state.cookieJar.setCookie(`${n}=${v.join('=')}; Domain=.instagram.com; Path=/`, 'https://instagram.com');
                if (n === 'ds_user_id') ig.state.generateDevice(v.join('='));
            }
            if (await validate('Config Cookies')) return;
        }

        if (fs.existsSync(cookiePath)) {
            const content = fs.readFileSync(cookiePath, 'utf8');
            if (content.includes('sessionid')) {
                const pairs = content.split(';').map(v => v.trim()).filter(v => v.length > 0);
                for (const p of pairs) {
                    const [n, ...v] = p.split('=');
                    await ig.state.cookieJar.setCookie(`${n}=${v.join('=')}; Domain=.instagram.com; Path=/`, 'https://instagram.com');
                    if (n === 'ds_user_id') ig.state.generateDevice(v.join('='));
                }
                if (await validate('cookies.txt')) return;
            }
        }

        if (fs.existsSync(sessionPath)) {
            try {
                await bot.loadSessionState(JSON.parse(fs.readFileSync(sessionPath, 'utf8')));
                if (await validate('Saved Session')) return;
            } catch (e) { }
        }

        const user = config.instagram.username;
        const pass = config.instagram.password;
        logger.info(`Fresh login for ${user}...`);
        ig.state.generateDevice(user);
        const auth = await ig.account.login(user, pass);
        bot.userId = auth.pk.toString();
        bot.username = auth.username;
        bot.isLoggedIn = true;

        const state = await bot.getSessionState();
        if (!fs.existsSync(path.join(__dirname, 'data'))) fs.mkdirSync(path.join(__dirname, 'data'));
        fs.writeFileSync(sessionPath, JSON.stringify(state, null, 2));

        isLoggedIn = true;
        logger.success(`Login Success: @${auth.username}`);
    } catch (e) {
        logger.error(`Login Failed: ${e.message}`);
        throw e;
    }
}

async function startListening() {
    try {
        const selfId = bot.getCurrentUserID().toString();
        const ig = bot.getIgClient();

        bot.on('message', async (event) => {
            if (event.is_from_me) return;

            let msgTime = event.message && event.message.timestamp ? Number(event.message.timestamp) : Date.now();
            if (msgTime > 1e14) msgTime /= 1000;
            else if (msgTime < 1e11) msgTime *= 1000;

            if (msgTime < botStartTime - 5000) {
                return;
            }

            const item = event.message;
            if (item && item.item_type === 'action_log') {
                const action = item.action_log;
                const users = action.additional_data ? (action.additional_data.added_user_ids || [action.user_id]) : [action.user_id];

                if (action.type === 'member_added' || action.type === 'user_joined') {
                    for (const uid of users) {
                        if (uid.toString() === selfId) {
                            logger.event(`Bot added to group.`);
                            await bot.dm.sendMessage(event.thread_id, getText('welcomeGroup', config.botName || 'MEHERAZ IG BOT', config.prefix));
                        } else {
                            try {
                                const user = await ig.user.info(uid);
                                logger.event(`Welcome: @${user.username}`);
                                await bot.dm.sendMessage(event.thread_id, getText('welcomeUser', user.username));
                            } catch (e) { }
                        }
                    }
                } else if (action.type === 'member_left' || action.type === 'member_removed') {
                    for (const uid of users) {
                        if (uid.toString() === selfId) continue;
                        try {
                            const user = await ig.user.info(uid);
                            logger.event(`Left: @${user.username}`);
                            await bot.dm.sendMessage(event.thread_id, getText('goodbyeUser', user.username));
                        } catch (e) { }
                    }
                }
            }
            if (event.text) {
                logger.info(`New message from @${event.username || 'unknown'}: ${event.text}`);
                await processMessage(event, event.thread_id);
            }
        });

        bot.dm.startPolling(5000);
        logger.success(`Listener active for @${bot.getCurrentUsername()}`);
    } catch (e) {
        logger.error(`Listener failed: ${e.message}`);
    }
}

function centerText(text, length = 0) {
    const maxWidth = process.stdout.columns || 80;
    const padding = Math.max(0, Math.floor((maxWidth - (length || text.replace(/\x1b\[[0-9;]*m/g, '').length)) / 2));
    console.log(' '.repeat(padding) + text);
}

async function main() {
    const maxWidth = process.stdout.columns || 80;
    const title = maxWidth > 60 ? titles[0] : titles[1];
    console.log(`\n${colors.yellow}${'═'.repeat(maxWidth - 1)}${colors.reset}`);
    title.forEach(t => centerText(t));
    console.log(`${colors.cyan}${colors.bright}Meheraz - Premium Instagram Bot${colors.reset}`);
    centerText(`${colors.blue}Version:${colors.reset} ${colors.green}${pkg.version}${colors.reset} ${colors.blue}|${colors.reset} ${colors.cyan}By UPoL ZOX Modify by MEHERAZ${colors.reset}`);
    console.log(`${colors.yellow}${'═'.repeat(maxWidth - 1)}\n`);

    try {
        loadLanguage();
        loadCommands();
        await login();
        await startListening();
        logger.success(`🚀 BOT IS NOW ONLINE`);
    } catch (e) {
        logger.error(`Startup Error: ${e.message}`);
        process.exit(1);
    }
}

process.on('SIGINT', () => { logger.warn(`Shutting down...`); process.exit(0); });
process.on('unhandledRejection', (e) => {
    if (e && e.message && (e.message.includes('502') || e.message.includes('504'))) return;
    logger.error(`Unhandled: ${e ? e.message : 'Unknown'}`);
});

main();
