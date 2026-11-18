import test from 'node:test';import assert from 'node:assert/strict';
import {apiSecurityFixture} from './helpers/api-security.mjs';
const request=body=>new Request('https://www.aepilog.com/api/recommend',{method:'POST',body:JSON.stringify(body)});
test('valid reading inputs remain intact while malformed, cross-origin and oversized inputs are rejected',async()=>{
 const api=apiSecurityFixture();const value=await api.readRecommendationInput(request({likedBooks:'No Exit',categories:['Mystery & Crime'],extraNotes:'A quick read'}));assert.equal(value.likedBooks,'No Exit');
 for(const req of [request({likedBooks:123}),request({extraNotes:'x'.repeat(1001)}),request({categories:['1','2','3','4']}),new Request('https://www.aepilog.com/api/recommend',{method:'POST',body:'{no'}),request(null)])await assert.rejects(api.readRecommendationInput(req),error=>error.status===400);
 await assert.rejects(api.readRecommendationInput(new Request('https://www.aepilog.com/api/recommend',{method:'POST',headers:{origin:'https://other.example'},body:'{}'})),error=>error.status===403);
 await assert.rejects(api.readRecommendationInput(request({likedBooks:'x'.repeat(40000)})),error=>error.status===413);
});
test('body-size enforcement also handles chunked requests without a Content-Length header',async()=>{
 const api=apiSecurityFixture();const stream=new ReadableStream({start(controller){controller.enqueue(new TextEncoder().encode('x'.repeat(32769)));controller.close()}});
 const req=new Request('https://www.aepilog.com/api/recommend',{method:'POST',body:stream,duplex:'half'});await assert.rejects(api.readRecommendationInput(req),error=>error.status===413);
});
test('recommendation and catalogue request limits are separate and expose a retry interval',()=>{
 const api=apiSecurityFixture();const req=new Request('https://www.aepilog.com/api/recommend',{headers:{'x-forwarded-for':'203.0.113.2'}});
 for(let i=0;i<8;i++)assert.equal(api.requestLimit(req,'recommend'),null);
 const denied=api.requestLimit(req,'recommend');assert.equal(denied.status,429);assert(Number(denied.headers.get('Retry-After'))>0);assert.equal(api.requestLimit(req,'catalogue'),null);
 const other=new Request('https://www.aepilog.com/api/recommend',{headers:{'x-forwarded-for':'203.0.113.3'}});assert.equal(api.requestLimit(other,'recommend'),null);
});
test('shared quota refusal or outage stops AI work rather than failing open',async()=>{
 assert.equal(await apiSecurityFixture().reserveAiRequest(),null);
 assert.equal((await apiSecurityFixture({budget:false}).reserveAiRequest()).status,429);
 assert.equal((await apiSecurityFixture({error:{message:'private database details'}}).reserveAiRequest()).status,503);
});
