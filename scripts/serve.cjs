const {spawn}=require('node:child_process');
const child=spawn(process.execPath,['node_modules/vite/bin/vite.js','--host','127.0.0.1'],{stdio:'inherit'});child.on('exit',code=>process.exit(code??1));
