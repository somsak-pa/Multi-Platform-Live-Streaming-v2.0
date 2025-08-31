const fs = require('fs');
const path = require('path');
const readline = require('readline');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

const CONFIG_FILE = path.join(__dirname, 'platforms-config.json');
const KEYS_FILE = path.join(__dirname, 'user-stream-keys.json');

// Helper functions
function loadConfig() {
  if (fs.existsSync(CONFIG_FILE)) {
    return JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8'));
  }
  return {};
}

function loadKeys() {
  if (fs.existsSync(KEYS_FILE)) {
    return JSON.parse(fs.readFileSync(KEYS_FILE, 'utf8'));
  }
  return {};
}

function saveConfig(config) {
  fs.writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2));
}

function saveKeys(keys) {
  fs.writeFileSync(KEYS_FILE, JSON.stringify(keys, null, 2));
}

// Main menu
function showMainMenu() {
  console.clear();
  console.log('🛠️  Multi-Platform RTMP Server Management Tool');
  console.log('=' * 50);
  console.log('1. 👤 Manage Users');
  console.log('2. 🌐 Manage Platforms');
  console.log('3. 👁️  View Current Configuration');
  console.log('4. 🚀 Start Server for User');
  console.log('5. 🚪 Exit');
  console.log('=' * 50);
  
  rl.question('Choose an option (1-5): ', (choice) => {
    switch (choice) {
      case '1':
        manageUsers();
        break;
      case '2':
        managePlatforms();
        break;
      case '3':
        viewConfiguration();
        break;
      case '4':
        startServerForUser();
        break;
      case '5':
        console.log('👋 Goodbye!');
        rl.close();
        break;
      default:
        console.log('❌ Invalid choice. Please try again.');
        setTimeout(showMainMenu, 1000);
    }
  });
}

// User management
function manageUsers() {
  console.clear();
  console.log('👤 User Management');
  console.log('=' * 30);
  console.log('1. 📝 Add New User');
  console.log('2. ✏️  Edit User');
  console.log('3. 🗑️  Delete User');
  console.log('4. 📋 List All Users');
  console.log('5. 🔙 Back to Main Menu');
  console.log('=' * 30);
  
  rl.question('Choose an option (1-5): ', (choice) => {
    switch (choice) {
      case '1':
        addUser();
        break;
      case '2':
        editUser();
        break;
      case '3':
        deleteUser();
        break;
      case '4':
        listUsers();
        break;
      case '5':
        showMainMenu();
        break;
      default:
        console.log('❌ Invalid choice.');
        setTimeout(manageUsers, 1000);
    }
  });
}

function addUser() {
  const keys = loadKeys();
  const config = loadConfig();
  
  console.log('\n📝 Adding New User');
  console.log('-' * 20);
  
  rl.question('User ID (unique): ', (userId) => {
    if (keys[userId]) {
      console.log('❌ User ID already exists!');
      setTimeout(manageUsers, 2000);
      return;
    }
    
    rl.question('User Name: ', (userName) => {
      rl.question('Email (optional): ', (email) => {
        const newUser = {
          name: userName,
          email: email || ''
        };
        
        // Add empty stream keys for all platforms
        Object.keys(config).forEach(platformKey => {
          newUser[platformKey] = '';
        });
        
        keys[userId] = newUser;
        saveKeys(keys);
        
        console.log(`✅ User '${userId}' added successfully!`);
        setTimeout(manageUsers, 2000);
      });
    });
  });
}

function editUser() {
  const keys = loadKeys();
  const users = Object.keys(keys);
  
  if (users.length === 0) {
    console.log('❌ No users found!');
    setTimeout(manageUsers, 2000);
    return;
  }
  
  console.log('\n✏️  Available Users:');
  users.forEach((userId, index) => {
    console.log(`${index + 1}. ${userId} (${keys[userId].name || 'Unnamed'})`);
  });
  
  rl.question('Choose user number: ', (choice) => {
    const userIndex = parseInt(choice) - 1;
    if (userIndex < 0 || userIndex >= users.length) {
      console.log('❌ Invalid choice!');
      setTimeout(manageUsers, 2000);
      return;
    }
    
    const userId = users[userIndex];
    editUserKeys(userId);
  });
}

function editUserKeys(userId) {
  const keys = loadKeys();
  const config = loadConfig();
  const user = keys[userId];
  
  console.log(`\n✏️  Editing Stream Keys for: ${user.name || userId}`);
  console.log('-' * 40);
  
  const platforms = Object.keys(config);
  let currentIndex = 0;
  
  function editNextPlatform() {
    if (currentIndex >= platforms.length) {
      saveKeys(keys);
      console.log('✅ User updated successfully!');
      setTimeout(manageUsers, 2000);
      return;
    }
    
    const platformKey = platforms[currentIndex];
    const platform = config[platformKey];
    const currentKey = user[platformKey] || '';
    
    console.log(`\n${platform.icon} ${platform.name}`);
    console.log(`Current key: ${currentKey || '(empty)'}`);
    
    rl.question(`New key (press Enter to skip): `, (newKey) => {
      if (newKey.trim() !== '') {
        user[platformKey] = newKey.trim();
      }
      currentIndex++;
      editNextPlatform();
    });
  }
  
  editNextPlatform();
}

function listUsers() {
  const keys = loadKeys();
  const users = Object.keys(keys);
  
  console.log('\n📋 All Users:');
  console.log('=' * 50);
  
  if (users.length === 0) {
    console.log('❌ No users found!');
  } else {
    users.forEach(userId => {
      const user = keys[userId];
      console.log(`👤 ${userId}`);
      console.log(`   Name: ${user.name || 'Unnamed'}`);
      console.log(`   Email: ${user.email || 'Not provided'}`);
      
      const hasKeys = Object.keys(user).filter(key => 
        key !== 'name' && key !== 'email' && user[key] && user[key].length > 0
      );
      console.log(`   Platforms: ${hasKeys.length > 0 ? hasKeys.join(', ') : 'None configured'}`);
      console.log('');
    });
  }
  
  rl.question('Press Enter to continue...', () => {
    manageUsers();
  });
}

// Platform management
function managePlatforms() {
  console.clear();
  console.log('🌐 Platform Management');
  console.log('=' * 30);
  console.log('1. 📝 Add New Platform');
  console.log('2. ✏️  Edit Platform');
  console.log('3. 🔄 Toggle Platform Status');
  console.log('4. 📋 List All Platforms');
  console.log('5. 🔙 Back to Main Menu');
  console.log('=' * 30);
  
  rl.question('Choose an option (1-5): ', (choice) => {
    switch (choice) {
      case '1':
        addPlatform();
        break;
      case '2':
        editPlatform();
        break;
      case '3':
        togglePlatform();
        break;
      case '4':
        listPlatforms();
        break;
      case '5':
        showMainMenu();
        break;
      default:
        console.log('❌ Invalid choice.');
        setTimeout(managePlatforms, 1000);
    }
  });
}

function addPlatform() {
  const config = loadConfig();
  
  console.log('\n📝 Adding New Platform');
  console.log('-' * 25);
  
  rl.question('Platform ID (unique): ', (platformId) => {
    if (config[platformId]) {
      console.log('❌ Platform ID already exists!');
      setTimeout(managePlatforms, 2000);
      return;
    }
    
    rl.question('Platform Name: ', (name) => {
      rl.question('RTMP URL: ', (rtmpUrl) => {
        rl.question('Icon (emoji): ', (icon) => {
          rl.question('Description: ', (description) => {
            rl.question('Enabled by default? (y/n): ', (enabled) => {
              config[platformId] = {
                name: name,
                rtmpUrl: rtmpUrl,
                icon: icon || '🟢',
                enabled: enabled.toLowerCase() === 'y',
                description: description || ''
              };
              
              saveConfig(config);
              
              // Add platform key to all existing users
              const keys = loadKeys();
              Object.keys(keys).forEach(userId => {
                keys[userId][platformId] = '';
              });
              saveKeys(keys);
              
              console.log(`✅ Platform '${platformId}' added successfully!`);
              setTimeout(managePlatforms, 2000);
            });
          });
        });
      });
    });
  });
}

function togglePlatform() {
  const config = loadConfig();
  const platforms = Object.keys(config);
  
  if (platforms.length === 0) {
    console.log('❌ No platforms found!');
    setTimeout(managePlatforms, 2000);
    return;
  }
  
  console.log('\n🔄 Toggle Platform Status:');
  platforms.forEach((platformId, index) => {
    const platform = config[platformId];
    const status = platform.enabled ? '✅ Enabled' : '❌ Disabled';
    console.log(`${index + 1}. ${platform.icon} ${platform.name} (${status})`);
  });
  
  rl.question('Choose platform number to toggle: ', (choice) => {
    const platformIndex = parseInt(choice) - 1;
    if (platformIndex < 0 || platformIndex >= platforms.length) {
      console.log('❌ Invalid choice!');
      setTimeout(managePlatforms, 2000);
      return;
    }
    
    const platformId = platforms[platformIndex];
    config[platformId].enabled = !config[platformId].enabled;
    saveConfig(config);
    
    const status = config[platformId].enabled ? 'enabled' : 'disabled';
    console.log(`✅ Platform '${config[platformId].name}' ${status}!`);
    setTimeout(managePlatforms, 2000);
  });
}

function listPlatforms() {
  const config = loadConfig();
  const platforms = Object.keys(config);
  
  console.log('\n📋 All Platforms:');
  console.log('=' * 60);
  
  if (platforms.length === 0) {
    console.log('❌ No platforms found!');
  } else {
    platforms.forEach(platformId => {
      const platform = config[platformId];
      const status = platform.enabled ? '✅ Enabled' : '❌ Disabled';
      console.log(`${platform.icon} ${platform.name} (${platformId})`);
      console.log(`   Status: ${status}`);
      console.log(`   RTMP URL: ${platform.rtmpUrl}`);
      console.log(`   Description: ${platform.description || 'No description'}`);
      console.log('');
    });
  }
  
  rl.question('Press Enter to continue...', () => {
    managePlatforms();
  });
}

// View configuration
function viewConfiguration() {
  const config = loadConfig();
  const keys = loadKeys();
  
  console.clear();
  console.log('👁️  Current Configuration');
  console.log('=' * 50);
  
  console.log('\n🌐 Platforms:');
  Object.entries(config).forEach(([platformId, platform]) => {
    const status = platform.enabled ? '✅' : '❌';
    console.log(`${status} ${platform.icon} ${platform.name}`);
  });
  
  console.log('\n👤 Users:');
  Object.entries(keys).forEach(([userId, user]) => {
    const platformCount = Object.keys(user).filter(key => 
      key !== 'name' && key !== 'email' && user[key] && user[key].length > 0
    ).length;
    console.log(`👤 ${userId} (${user.name || 'Unnamed'}) - ${platformCount} platforms configured`);
  });
  
  rl.question('\nPress Enter to continue...', () => {
    showMainMenu();
  });
}

// Start server for user
function startServerForUser() {
  const keys = loadKeys();
  const users = Object.keys(keys);
  
  if (users.length === 0) {
    console.log('❌ No users found! Please add users first.');
    setTimeout(showMainMenu, 2000);
    return;
  }
  
  console.log('\n🚀 Start Server for User:');
  users.forEach((userId, index) => {
    console.log(`${index + 1}. ${userId} (${keys[userId].name || 'Unnamed'})`);
  });
  
  rl.question('Choose user number: ', (choice) => {
    const userIndex = parseInt(choice) - 1;
    if (userIndex < 0 || userIndex >= users.length) {
      console.log('❌ Invalid choice!');
      setTimeout(showMainMenu, 2000);
      return;
    }
    
    const userId = users[userIndex];
    console.log(`🚀 Starting server for user: ${userId}`);
    console.log('💡 Use Ctrl+C to stop the server');
    
    const { spawn } = require('child_process');
    const serverProcess = spawn('node', ['multi-platform-server.js', userId], {
      stdio: 'inherit',
      cwd: __dirname
    });
    
    serverProcess.on('close', (code) => {
      console.log(`\n✅ Server stopped (exit code: ${code})`);
      setTimeout(showMainMenu, 2000);
    });
  });
}

// Start the management tool
console.log('🛠️  Initializing Multi-Platform RTMP Server Management Tool...');
setTimeout(showMainMenu, 1000);