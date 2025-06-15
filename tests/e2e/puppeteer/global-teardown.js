module.exports = async () => {
  if (global.__SERVER__) {
    console.log('Shutting down test server...');
    global.__SERVER__.kill('SIGTERM');
    
    await new Promise((resolve) => {
      global.__SERVER__.on('exit', resolve);
      setTimeout(() => {
        global.__SERVER__.kill('SIGKILL');
        resolve();
      }, 5000);
    });
  }
};