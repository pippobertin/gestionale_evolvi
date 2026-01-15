// Test script to simulate the frontend login flow
const fetch = require('node-fetch');

async function testLoginFlow() {
  console.log('=== Testing Login Flow ===\n');

  try {
    // Step 1: Login with temporary password
    console.log('1. Attempting login with test user...');
    const loginResponse = await fetch('http://localhost:3000/api/auth/login', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        email: 'test@example.com',
        password: 'user!'
      })
    });

    const loginResult = await loginResponse.json();
    console.log('Login API Response:', loginResult);

    // Step 2: Check if password change is required
    if (loginResult.success && loginResult.requiresPasswordChange) {
      console.log('\n✅ Backend correctly detected password change requirement');
      console.log('🔄 Frontend should now show password change form');

      // Step 3: Test password change API
      console.log('\n2. Testing password change...');
      const changePasswordResponse = await fetch('http://localhost:3000/api/auth/change-password', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${loginResult.token}`
        },
        body: JSON.stringify({
          currentPassword: 'user!',
          newPassword: 'newpassword123'
        })
      });

      const changeResult = await changePasswordResponse.json();
      console.log('Password Change API Response:', changeResult);

      if (changeResult.success) {
        console.log('\n✅ Password change successful');
        console.log('🎉 User should now be logged in with new password');
      } else {
        console.log('\n❌ Password change failed:', changeResult.error);
      }
    } else {
      console.log('\n❌ Backend did not detect password change requirement');
      console.log('Response:', loginResult);
    }

  } catch (error) {
    console.error('Test failed with error:', error.message);
  }
}

testLoginFlow();