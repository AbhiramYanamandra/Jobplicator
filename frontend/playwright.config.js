import {defineConfig} from '@playwright/test';
import path from 'node:path';
const python=process.env.JOBPLICATOR_TEST_PYTHON || (process.platform==='win32'?'../app/.venv/Scripts/python.exe':'../app/.venv/bin/python');
export default defineConfig({testDir:'./e2e',use:{baseURL:'http://127.0.0.1:8790',trace:'retain-on-failure'},webServer:{command:`"${python}" ../tests/serve_test.py`,url:'http://127.0.0.1:8790/api/health',reuseExistingServer:false},projects:[{name:'desktop',use:{viewport:{width:1440,height:1000}}},{name:'mobile',use:{viewport:{width:390,height:844}}}]});
