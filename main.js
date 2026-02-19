/**
 * 投資判断AI - Electronメインプロセス
 * ダブルクリックでデスクトップアプリとして起動する
 */

const path = require('path');
const electron = require('electron');

// 環境変数の干渉を防止
const { app, BrowserWindow, shell, Menu } = electron;

// セキュリティ警告を抑制
process.env['ELECTRON_DISABLE_SECURITY_WARNINGS'] = 'true';

let mainWindow;

function createWindow() {
    mainWindow = new BrowserWindow({
        width: 1400,
        height: 900,
        minWidth: 800,
        minHeight: 600,
        title: '投資判断AI',
        titleBarStyle: 'hidden',
        titleBarOverlay: {
            color: '#0a0e1a',
            symbolColor: '#e2e8f0',
            height: 32
        },
        // 起動時のチラツキを抑える
        // 起動時のチラツキを抑える
        backgroundColor: '#0a0e1a',
        show: true, // デバッグのため強制表示
        webPreferences: {
            nodeIntegration: false,
            contextIsolation: true,
            webSecurity: false,
        },
    });

    // メニューバーを非表示
    Menu.setApplicationMenu(null);

    mainWindow.loadFile(path.join(__dirname, 'index.html'));

    // 開発モードまたは特定の引数がある場合に開発者ツールを有効化
    // const isDev = process.argv.includes('--dev') || !app.isPackaged;

    // if (isDev) {
    //     mainWindow.webContents.openDevTools();
    // }

    // ショートカットキーの設定（F12, Ctrl+Shift+I）
    mainWindow.webContents.on('before-input-event', (event, input) => {
        if (input.key === 'F12' || (input.control && input.shift && input.key.toLowerCase() === 'i')) {
            mainWindow.webContents.toggleDevTools();
            event.preventDefault();
        }
        if (input.key === 'F5' || (input.control && input.key.toLowerCase() === 'r')) {
            mainWindow.reload();
            event.preventDefault();
        }
    });

    // 準備ができたら表示（これで白画面のフラッシュを防ぐ）
    mainWindow.once('ready-to-show', () => {
        mainWindow.show();
    });

    // 強制表示（保険）
    setTimeout(() => {
        if (mainWindow && !mainWindow.isVisible()) {
            console.log('Force showing window after timeout');
            mainWindow.show();
        }
    }, 3000);

    // 外部リンクはデフォルトブラウザで開く
    mainWindow.webContents.setWindowOpenHandler(({ url }) => {
        shell.openExternal(url);
        return { action: 'deny' };
    });

    mainWindow.webContents.on('will-navigate', (event, url) => {
        if (!url.startsWith('file://')) {
            event.preventDefault();
            shell.openExternal(url);
        }
    });

    mainWindow.on('closed', () => {
        mainWindow = null;
    });
}

// アプリ起動時
app.whenReady().then(() => {
    createWindow();

    app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) {
            createWindow();
        }
    });
});

// 全ウィンドウを閉じたら終了
app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit();
    }
});
