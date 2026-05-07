const { getDatabase } = require('./index');
const { runMigrations } = require('./migration');
const { applications, websites, appSessions, dailyStats, userConfig, formatDate } = require('./utils');

async function runTests() {
  console.log('========================================');
  console.log('Running SQLite Database Tests');
  console.log('========================================\n');

  try {
    console.log('1. Testing database connection...');
    const db = getDatabase();
    console.log('   ✓ Database connection successful');

    console.log('\n2. Running migrations...');
    await runMigrations();
    console.log('   ✓ Migrations completed successfully');

    console.log('\n3. Testing applications table...');
    const appId = applications.create({
      app_name: 'TestApp',
      process_name: 'test.exe',
      category: 'work'
    });
    console.log(`   ✓ Created application with ID: ${appId}`);
    
    const app = applications.getById(appId);
    console.log(`   ✓ Retrieved application: ${app.app_name}`);

    console.log('\n4. Testing websites table...');
    const websiteId = websites.create({
      domain: 'example.com',
      name: 'Example',
      category: 'entertainment'
    });
    console.log(`   ✓ Created website with ID: ${websiteId}`);
    
    const website = websites.getById(websiteId);
    console.log(`   ✓ Retrieved website: ${website.domain}`);

    console.log('\n5. Testing app_sessions table...');
    const sessionId = appSessions.create({
      app_id: appId,
      start_time: Date.now() - 3600000,
      end_time: Date.now(),
      duration_ms: 3600000,
      window_title: 'Test Window'
    });
    console.log(`   ✓ Created app session with ID: ${sessionId}`);

    console.log('\n6. Testing daily_stats table...');
    const today = formatDate(Date.now());
    const statsResult = dailyStats.createOrUpdate('app', appId, today, {
      total_duration_ms: 3600000,
      session_count: 1,
      hourly_data: JSON.stringify([0, 0, 0, 0, 0, 0, 0, 0, 0, 3600000, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0])
    });
    console.log(`   ✓ Created/updated daily stats: ${statsResult}`);

    console.log('\n7. Testing user_config table...');
    const configResult = userConfig.set('test_key', { value: 'test_value', nested: { data: 123 } });
    console.log(`   ✓ Set config: ${configResult}`);
    
    const configValue = userConfig.getByKey('test_key');
    console.log(`   ✓ Retrieved config: ${JSON.stringify(configValue)}`);

    console.log('\n8. Testing queries...');
    const allApps = applications.getAll();
    console.log(`   ✓ Found ${allApps.length} applications`);
    
    const allWebsites = websites.getAll();
    console.log(`   ✓ Found ${allWebsites.length} websites`);

    console.log('\n========================================');
    console.log('All tests passed! ✓');
    console.log('========================================');

  } catch (error) {
    console.error('\n❌ Test failed:', error);
    process.exit(1);
  }
}

runTests();
