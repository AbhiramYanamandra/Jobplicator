// Run locally with npm run test:browser after installing Playwright Chromium.
// The web server uses a disposable database of fictional data.
import {test,expect} from '@playwright/test';
const routes=['dashboard','jobs','clusters','applications','resume','evidence','analytics','interview','questions','skills','strategy','ingestion','profile'];
for(const route of routes){test(`${route} renders without runtime errors or document overflow`,async({page})=>{const errors=[];page.on('pageerror',e=>errors.push(e.message));await page.goto('/#'+route);await expect(page.locator('main')).toBeVisible();await expect(page.getByText('Loading your workspace…')).toHaveCount(0);await expect(page.getByText(/Could not load this page/)).toHaveCount(0);expect(errors).toEqual([]);expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true)})}
test('dark mode persists through reload',async({page})=>{await page.goto('/');await page.getByRole('button',{name:'Toggle color mode'}).click();const theme=await page.locator('html').getAttribute('class');await page.reload();await expect(page.locator('html')).toHaveAttribute('class',theme)});
test('question attempt persists after reload',async({page})=>{await page.goto('/#questions');const row=page.locator('tbody tr').first();const before=Number((await row.innerText()).match(/(\d+) attempts/)[1]);await row.getByRole('button',{name:'Log attempt'}).click();await page.getByLabel('Solved?',{exact:true}).selectOption('Yes');await page.getByLabel('Time taken (minutes)').fill('12');await page.getByRole('dialog').getByRole('button',{name:'Save',exact:true}).click();await expect(page.getByRole('dialog')).toHaveCount(0);await page.reload();await expect(page.locator('tbody tr').first()).toContainText(`${before+1} attempts`)});

test('sidebar collapses on desktop and closes with Escape on mobile',async({page},testInfo)=>{
  await page.goto('/');
  if(testInfo.project.name==='desktop'){
    await page.getByRole('button',{name:'Collapse sidebar'}).click();
    await expect(page.getByRole('button',{name:'Expand sidebar'})).toHaveAttribute('aria-expanded','false');
    await page.reload();
    await expect(page.getByRole('button',{name:'Expand sidebar'})).toBeVisible();
    await page.getByRole('button',{name:'Jobs',exact:true}).click();
    await expect(page.getByRole('heading',{name:'Find the right fit.'})).toBeVisible();
  }else{
    await page.getByRole('button',{name:'Toggle navigation'}).click();
    await expect(page.getByRole('complementary',{name:'Workspace navigation'})).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.getByRole('complementary',{name:'Workspace navigation'})).toBeHidden();
  }
});
