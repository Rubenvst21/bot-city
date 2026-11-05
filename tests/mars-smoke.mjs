import { chromium } from "playwright";
import assert from "node:assert/strict";
import fs from "node:fs/promises";

const browser=await chromium.launch({headless:true,args:["--no-sandbox","--use-gl=angle","--use-angle=swiftshader"]});
await fs.mkdir("test-output",{recursive:true});
let failures=[];
try{
  for (const vp of [{width:390,height:844,name:"iphone"},{width:1280,height:800,name:"desktop"}]){
    const context=await browser.newContext({viewport:{width:vp.width,height:vp.height},deviceScaleFactor:1,reducedMotion:"reduce"});
    const page=await context.newPage();
    const errors=[];
    page.on("pageerror",e=>errors.push(e.message));
    await page.goto("http://127.0.0.1:8765/?smoke=1",{waitUntil:"networkidle"});
    await page.waitForSelector("#marsCity:not([hidden])");
    await page.waitForFunction(()=>document.querySelectorAll("#marsDistricts button").length>=9,{timeout:20000});
    assert.equal(await page.locator("body.mars-mode").count(),1,"Mars colony is the default view");
    const count=await page.locator("#marsDistricts button").count();
    assert.ok(count>=11,"Five departments, planned stores and project plots are configured");
    assert.equal(await page.locator("#crToggle:visible").count(),0,"Classic controls stay out of Mars view");
    await page.screenshot({path:"test-output/mars-"+vp.name+".png",fullPage:true});
    const c=page.locator("#marsDistricts button").filter({hasText:"Creative Studio"}).first();
    await c.click();
    assert.match(await page.locator("#marsScreen").innerText(),/Creative Studio/);
    await page.screenshot({path:"test-output/mars-district-"+vp.name+".png",fullPage:true});
    const rect=await page.locator("#marsCanvas").boundingBox();
    const point={x:rect.x+rect.width*.5,y:rect.y+rect.height*.35};
    const scene=await page.evaluate(p=>({node:document.elementFromPoint(p.x,p.y)?.id||document.elementFromPoint(p.x,p.y)?.className,debug:window.__marsDebug?.()}),point);
    console.log("district hit",vp.name,JSON.stringify({point,scene}).slice(0,900));
    await page.mouse.click(point.x,point.y);
    await page.waitForTimeout(100);
    assert.match(await page.locator("#marsScreen").innerText(),/Storyboard|Edit timeline|Private review/,"Tap on workstation opens its room");
    await page.locator("#marsBack").click();
    assert.match(await page.locator("#marsScreen").innerText(),/Creative Studio/);
    await page.locator("#marsBack").click();
    assert.match(await page.locator("#marsScreen").innerText(),/Colony overview/);
    await page.locator("#marsZoomIn").click();
    await page.locator("#marsZoomOut").click();
    await page.locator("#marsReports").click();
    assert.equal(await page.locator("#marsCity:visible").count(),0,"Reports hide Mars");
    assert.equal(await page.locator("#controlRoom:visible").count(),1,"Classic dashboard opens");
    await page.locator("#marsReturn").click();
    assert.equal(await page.locator("#marsCity:visible").count(),1,"Back to Mars works");
    await page.locator("#marsClassic").click();
    assert.equal(await page.locator("#workfloor:visible").count(),1,"Classic operations floor remains available");
    await page.locator("#marsReturn").click();
    assert.equal(await page.locator("#marsCity:visible").count(),1);
    if(errors.length)failures.push(vp.name+": "+errors.join(" | ").slice(0,1000));
    await context.close();
    console.log(vp.name+": success ("+count+" plots)");
  }
}finally{await browser.close();}
if(failures.length)throw new Error("Browser errors: "+failures.join("\n"));
console.log("Mars colony responsive navigation passed.");
