(()=>{var a={};a.id=14,a.ids=[14],a.modules={261:a=>{"use strict";a.exports=require("next/dist/shared/lib/router/utils/app-paths")},1932:a=>{"use strict";a.exports=require("url")},3295:a=>{"use strict";a.exports=require("next/dist/server/app-render/after-task-async-storage.external.js")},10846:a=>{"use strict";a.exports=require("next/dist/compiled/next-server/app-page.runtime.prod.js")},11723:a=>{"use strict";a.exports=require("querystring")},12412:a=>{"use strict";a.exports=require("assert")},18079:(a,b)=>{"use strict";b.A=function(a){return{id:"credentials",name:"Credentials",type:"credentials",credentials:{},authorize:()=>null,options:a}}},19225:(a,b,c)=>{"use strict";a.exports=c(44870)},20903:(a,b,c)=>{"use strict";c.d(b,{A:()=>e});var d=c(96330);let e=globalThis.prisma??new d.PrismaClient},28354:a=>{"use strict";a.exports=require("util")},29294:a=>{"use strict";a.exports=require("next/dist/server/app-render/work-async-storage.external.js")},44870:a=>{"use strict";a.exports=require("next/dist/compiled/next-server/app-route.runtime.prod.js")},55511:a=>{"use strict";a.exports=require("crypto")},55591:a=>{"use strict";a.exports=require("https")},63033:a=>{"use strict";a.exports=require("next/dist/server/app-render/work-unit-async-storage.external.js")},69541:(a,b,c)=>{"use strict";c.d(b,{$4:()=>g,BK:()=>y,Bj:()=>v,Ck:()=>w,Fl:()=>f,Jx:()=>i,Zb:()=>h,nc:()=>u,u6:()=>x});var d=c(20903),e=c(78930);let f={canPlaceOrder:!0,canExitPosition:!0,canModifySLTarget:!0,canCancelOrder:!0,canViewReports:!0},g={canPlaceOrder:!0,canExitPosition:!0,canModifySLTarget:!0,canCancelOrder:!0,canViewReports:!0},h={maxOpenPositions:5,maxOrderQuantity:900,maxDailyLoss:5e4,maxOrderNotional:5e6},i={maxOpenPositions:100,maxOrderQuantity:1e5,maxDailyLoss:1e8,maxOrderNotional:1e9},j=null;function k(a,b,c,d){let e=Number(a);return Number.isFinite(e)?Math.min(d,Math.max(c,e)):b}function l(a){if(!a)return{};if("string"==typeof a)try{let b=JSON.parse(a);return b&&"object"==typeof b?b:{}}catch{return{}}return"object"==typeof a?a:{}}function m(a,b){return(0,e.K)(b)||"ADMIN"===String(a||"").toUpperCase()?"ADMIN":"USER"}function n(a,b){return(0,e.K)(b)?"ACTIVE":"DISABLED"===String(a||"").toUpperCase()?"DISABLED":"ACTIVE"}function o(a,b){let c=l(a),d="ADMIN"===b?g:f;return{canPlaceOrder:"boolean"==typeof c.canPlaceOrder?c.canPlaceOrder:d.canPlaceOrder,canExitPosition:"boolean"==typeof c.canExitPosition?c.canExitPosition:d.canExitPosition,canModifySLTarget:"boolean"==typeof c.canModifySLTarget?c.canModifySLTarget:d.canModifySLTarget,canCancelOrder:"boolean"==typeof c.canCancelOrder?c.canCancelOrder:d.canCancelOrder,canViewReports:"boolean"==typeof c.canViewReports?c.canViewReports:d.canViewReports}}function p(a,b){let c=l(a),d="ADMIN"===b?i:h;return{maxOpenPositions:Math.floor(k(c.maxOpenPositions,d.maxOpenPositions,1,1e3)),maxOrderQuantity:Math.floor(k(c.maxOrderQuantity,d.maxOrderQuantity,1,1e6)),maxDailyLoss:k(c.maxDailyLoss,d.maxDailyLoss,1e3,1e9),maxOrderNotional:k(c.maxOrderNotional,d.maxOrderNotional,1e4,1e10)}}function q(a,b){let c=(0,e.K)(b)?"ADMIN":"USER",d=new Date;return{userId:a,role:c,status:"ACTIVE",permissions:"ADMIN"===c?g:f,riskLimits:"ADMIN"===c?i:h,createdAt:d,updatedAt:d}}function r(a,b){let c=m(a.role,b),d=n(a.status,b);return{userId:a.userId,role:c,status:d,permissions:o(a.permissions,c),riskLimits:p(a.riskLimits,c),createdAt:a.createdAt,updatedAt:a.updatedAt}}async function s(){if(j)return j;j=(async()=>{await d.A.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "UserAccessControl" (
        "userId" TEXT PRIMARY KEY REFERENCES "User"("id") ON DELETE CASCADE,
        "role" TEXT NOT NULL DEFAULT 'USER',
        "status" TEXT NOT NULL DEFAULT 'ACTIVE',
        "permissions" JSONB NOT NULL DEFAULT '{}'::jsonb,
        "riskLimits" JSONB NOT NULL DEFAULT '{}'::jsonb,
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
      )
    `),await d.A.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "AdminAuditLog" (
        "id" BIGSERIAL PRIMARY KEY,
        "actorUserId" TEXT,
        "actorEmail" TEXT,
        "targetUserId" TEXT,
        "action" TEXT NOT NULL,
        "details" JSONB NOT NULL DEFAULT '{}'::jsonb,
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
      )
    `),await d.A.$executeRawUnsafe(`
      CREATE INDEX IF NOT EXISTS "AdminAuditLog_createdAt_idx"
      ON "AdminAuditLog" ("createdAt")
    `)})();try{await j}catch(a){throw j=null,a}}async function t(a){return(await d.A.$queryRaw`
    SELECT "userId", "role", "status", "permissions", "riskLimits", "createdAt", "updatedAt"
    FROM "UserAccessControl"
    WHERE "userId" = ${a}
    LIMIT 1
  `)[0]??null}async function u(a,b){await s();let c=await t(a);if(c){let d=r(c,b);return(0,e.K)(b)&&("ADMIN"!==d.role||"ACTIVE"!==d.status)?v(a,b,{role:"ADMIN",status:"ACTIVE"}):d}let f=q(a,b);await d.A.$executeRaw`
    INSERT INTO "UserAccessControl" ("userId", "role", "status", "permissions", "riskLimits", "createdAt", "updatedAt")
    VALUES (
      ${f.userId},
      ${f.role},
      ${f.status},
      ${JSON.stringify(f.permissions)}::jsonb,
      ${JSON.stringify(f.riskLimits)}::jsonb,
      NOW(),
      NOW()
    )
    ON CONFLICT ("userId") DO NOTHING
  `;let g=await t(a);return g?r(g,b):f}async function v(a,b,c){let e=await u(a,b),f=m(c.role??e.role,b),g=n(c.status??e.status,b),h=o({...e.permissions,...c.permissions??{}},f),i=p({...e.riskLimits,...c.riskLimits??{}},f);await d.A.$executeRaw`
    INSERT INTO "UserAccessControl" ("userId", "role", "status", "permissions", "riskLimits", "createdAt", "updatedAt")
    VALUES (
      ${a},
      ${f},
      ${g},
      ${JSON.stringify(h)}::jsonb,
      ${JSON.stringify(i)}::jsonb,
      NOW(),
      NOW()
    )
    ON CONFLICT ("userId")
    DO UPDATE SET
      "role" = EXCLUDED."role",
      "status" = EXCLUDED."status",
      "permissions" = EXCLUDED."permissions",
      "riskLimits" = EXCLUDED."riskLimits",
      "updatedAt" = NOW()
  `;let j=await t(a);return j?r(j,b):q(a,b)}async function w(a){let b=new Map;return(await Promise.all(a.map(async a=>({userId:a.id,access:await u(a.id,a.email)})))).forEach(({userId:a,access:c})=>b.set(a,c)),b}async function x(a){await s(),await d.A.$executeRaw`
    INSERT INTO "AdminAuditLog" ("actorUserId", "actorEmail", "targetUserId", "action", "details", "createdAt")
    VALUES (
      ${a.actorUserId??null},
      ${a.actorEmail??null},
      ${a.targetUserId??null},
      ${a.action},
      ${JSON.stringify(a.details??{})}::jsonb,
      NOW()
    )
  `}async function y(a=100){await s();let b=Math.max(1,Math.min(500,Math.floor(a)));return(await d.A.$queryRaw`
    SELECT
      "id"::text AS "id",
      "actorUserId",
      "actorEmail",
      "targetUserId",
      "action",
      "details",
      "createdAt"
    FROM "AdminAuditLog"
    ORDER BY "createdAt" DESC
    LIMIT ${b}
  `).map(a=>({id:a.id,actorUserId:a.actorUserId,actorEmail:a.actorEmail,targetUserId:a.targetUserId,action:a.action,details:l(a.details),createdAt:a.createdAt}))}},74075:a=>{"use strict";a.exports=require("zlib")},78335:()=>{},78930:(a,b,c)=>{"use strict";function d(a){let b,c=(b=(process.env.ADMIN_EMAIL||process.env.NEXT_PUBLIC_ADMIN_EMAIL||"").trim().toLowerCase()).length>0?b:null;return!!c&&!!a&&a.trim().toLowerCase()===c}c.d(b,{K:()=>d})},79428:a=>{"use strict";a.exports=require("buffer")},81630:a=>{"use strict";a.exports=require("http")},84449:(a,b,c)=>{"use strict";c.r(b),c.d(b,{handler:()=>H,patchFetch:()=>G,routeModule:()=>C,serverHooks:()=>F,workAsyncStorage:()=>D,workUnitAsyncStorage:()=>E});var d={};c.r(d),c.d(d,{GET:()=>B,POST:()=>B});var e=c(19225),f=c(84006),g=c(8317),h=c(99373),i=c(34775),j=c(24235),k=c(261),l=c(54365),m=c(90771),n=c(73461),o=c(67798),p=c(92280),q=c(62018),r=c(45696),s=c(47929),t=c(86439),u=c(37527),v=c(50172),w=c.n(v),x=c(18079),y=c(59795),z=c(20903),A=c(69541);let B=w()({providers:[(0,x.A)({name:"Credentials",credentials:{email:{label:"Email",type:"email"},password:{label:"Password",type:"password"}},async authorize(a){if(!a?.email||!a?.password)return null;let b=await z.A.user.findUnique({where:{email:a.email}});if(!b||!b.password||!await (0,y.compare)(a.password,b.password))return null;let c=await (0,A.nc)(b.id,b.email);return"DISABLED"===c.status?null:{id:b.id,email:b.email,name:b.name,role:c.role,status:c.status}}})],session:{strategy:"jwt",maxAge:2592e3},callbacks:{async jwt({token:a,user:b}){let c=b?.id??a.id;if(!c)return a;a.id=c;let d="string"==typeof b?.email?b.email:null,e=d?{email:d}:await z.A.user.findUnique({where:{id:c},select:{email:!0}});if(!e)return a.role="USER",a.status="DISABLED",a;let f=await (0,A.nc)(c,e?.email??null);return a.role=f.role,a.status=f.status,a},session:async({session:a,token:b})=>(a.user&&(a.user.id=b.id,a.user.role=b.role||"USER",a.user.status=b.status||"ACTIVE"),a)},pages:{signIn:"/auth/signin",error:"/auth/error"}}),C=new e.AppRouteRouteModule({definition:{kind:f.RouteKind.APP_ROUTE,page:"/api/auth/[...nextauth]/route",pathname:"/api/auth/[...nextauth]",filename:"route",bundlePath:"app/api/auth/[...nextauth]/route"},distDir:".next",relativeProjectDir:"",resolvedPagePath:"C:\\Users\\Admin\\Desktop\\Paper-Trading-Web-APP\\src\\app\\api\\auth\\[...nextauth]\\route.ts",nextConfigOutput:"",userland:d}),{workAsyncStorage:D,workUnitAsyncStorage:E,serverHooks:F}=C;function G(){return(0,g.patchFetch)({workAsyncStorage:D,workUnitAsyncStorage:E})}async function H(a,b,c){c.requestMeta&&(0,h.setRequestMeta)(a,c.requestMeta),C.isDev&&(0,h.addRequestMeta)(a,"devRequestTimingInternalsEnd",process.hrtime.bigint());let d="/api/auth/[...nextauth]/route";"/index"===d&&(d="/");let e=await C.prepare(a,b,{srcPage:d,multiZoneDraftMode:!1});if(!e)return b.statusCode=400,b.end("Bad Request"),null==c.waitUntil||c.waitUntil.call(c,Promise.resolve()),null;let{buildId:g,params:v,nextConfig:w,parsedUrl:x,isDraftMode:y,prerenderManifest:z,routerServerContext:A,isOnDemandRevalidate:B,revalidateOnlyGenerated:D,resolvedPathname:E,clientReferenceManifest:F,serverActionsManifest:G}=e,H=(0,k.normalizeAppPath)(d),I=!!(z.dynamicRoutes[H]||z.routes[E]),J=async()=>((null==A?void 0:A.render404)?await A.render404(a,b,x,!1):b.end("This page could not be found"),null);if(I&&!y){let a=!!z.routes[E],b=z.dynamicRoutes[H];if(b&&!1===b.fallback&&!a){if(w.adapterPath)return await J();throw new t.NoFallbackError}}let K=null;!I||C.isDev||y||(K="/index"===(K=E)?"/":K);let L=!0===C.isDev||!I,M=I&&!L;G&&F&&(0,j.setManifestsSingleton)({page:d,clientReferenceManifest:F,serverActionsManifest:G});let N=a.method||"GET",O=(0,i.getTracer)(),P=O.getActiveScopeSpan(),Q=!!(null==A?void 0:A.isWrappedByNextServer),R=!!(0,h.getRequestMeta)(a,"minimalMode"),S=(0,h.getRequestMeta)(a,"incrementalCache")||await C.getIncrementalCache(a,w,z,R);null==S||S.resetRequestCache(),globalThis.__incrementalCache=S;let T={params:v,previewProps:z.preview,renderOpts:{experimental:{authInterrupts:!!w.experimental.authInterrupts},cacheComponents:!!w.cacheComponents,supportsDynamicResponse:L,incrementalCache:S,cacheLifeProfiles:w.cacheLife,waitUntil:c.waitUntil,onClose:a=>{b.on("close",a)},onAfterTaskError:void 0,onInstrumentationRequestError:(b,c,d,e)=>C.onRequestError(a,b,d,e,A)},sharedContext:{buildId:g}},U=new l.NodeNextRequest(a),V=new l.NodeNextResponse(b),W=m.NextRequestAdapter.fromNodeNextRequest(U,(0,m.signalFromNodeResponse)(b));try{let e,g=async a=>C.handle(W,T).finally(()=>{if(!a)return;a.setAttributes({"http.status_code":b.statusCode,"next.rsc":!1});let c=O.getRootSpanAttributes();if(!c)return;if(c.get("next.span_type")!==n.BaseServerSpan.handleRequest)return void console.warn(`Unexpected root span type '${c.get("next.span_type")}'. Please report this Next.js issue https://github.com/vercel/next.js`);let f=c.get("next.route");if(f){let b=`${N} ${f}`;a.setAttributes({"next.route":f,"http.route":f,"next.span_name":b}),a.updateName(b),e&&e!==a&&(e.setAttribute("http.route",f),e.updateName(b))}else a.updateName(`${N} ${d}`)}),h=async e=>{var h,i;let j=async({previousCacheEntry:f})=>{try{if(!R&&B&&D&&!f)return b.statusCode=404,b.setHeader("x-nextjs-cache","REVALIDATED"),b.end("This page could not be found"),null;let d=await g(e);a.fetchMetrics=T.renderOpts.fetchMetrics;let h=T.renderOpts.pendingWaitUntil;h&&c.waitUntil&&(c.waitUntil(h),h=void 0);let i=T.renderOpts.collectedTags;if(!I)return await (0,p.I)(U,V,d,T.renderOpts.pendingWaitUntil),null;{let a=await d.blob(),b=(0,q.toNodeOutgoingHttpHeaders)(d.headers);i&&(b[s.NEXT_CACHE_TAGS_HEADER]=i),!b["content-type"]&&a.type&&(b["content-type"]=a.type);let c=void 0!==T.renderOpts.collectedRevalidate&&!(T.renderOpts.collectedRevalidate>=s.INFINITE_CACHE)&&T.renderOpts.collectedRevalidate,e=void 0===T.renderOpts.collectedExpire||T.renderOpts.collectedExpire>=s.INFINITE_CACHE?void 0:T.renderOpts.collectedExpire;return{value:{kind:u.CachedRouteKind.APP_ROUTE,status:d.status,body:Buffer.from(await a.arrayBuffer()),headers:b},cacheControl:{revalidate:c,expire:e}}}}catch(b){throw(null==f?void 0:f.isStale)&&await C.onRequestError(a,b,{routerKind:"App Router",routePath:d,routeType:"route",revalidateReason:(0,o.c)({isStaticGeneration:M,isOnDemandRevalidate:B})},!1,A),b}},k=await C.handleResponse({req:a,nextConfig:w,cacheKey:K,routeKind:f.RouteKind.APP_ROUTE,isFallback:!1,prerenderManifest:z,isRoutePPREnabled:!1,isOnDemandRevalidate:B,revalidateOnlyGenerated:D,responseGenerator:j,waitUntil:c.waitUntil,isMinimalMode:R});if(!I)return null;if((null==k||null==(h=k.value)?void 0:h.kind)!==u.CachedRouteKind.APP_ROUTE)throw Object.defineProperty(Error(`Invariant: app-route received invalid cache entry ${null==k||null==(i=k.value)?void 0:i.kind}`),"__NEXT_ERROR_CODE",{value:"E701",enumerable:!1,configurable:!0});R||b.setHeader("x-nextjs-cache",B?"REVALIDATED":k.isMiss?"MISS":k.isStale?"STALE":"HIT"),y&&b.setHeader("Cache-Control","private, no-cache, no-store, max-age=0, must-revalidate");let l=(0,q.fromNodeOutgoingHttpHeaders)(k.value.headers);return R&&I||l.delete(s.NEXT_CACHE_TAGS_HEADER),!k.cacheControl||b.getHeader("Cache-Control")||l.get("Cache-Control")||l.set("Cache-Control",(0,r.getCacheControlHeader)(k.cacheControl)),await (0,p.I)(U,V,new Response(k.value.body,{headers:l,status:k.value.status||200})),null};Q&&P?await h(P):(e=O.getActiveScopeSpan(),await O.withPropagatedContext(a.headers,()=>O.trace(n.BaseServerSpan.handleRequest,{spanName:`${N} ${d}`,kind:i.SpanKind.SERVER,attributes:{"http.method":N,"http.target":a.url}},h),void 0,!Q))}catch(b){if(b instanceof t.NoFallbackError||await C.onRequestError(a,b,{routerKind:"App Router",routePath:H,routeType:"route",revalidateReason:(0,o.c)({isStaticGeneration:M,isOnDemandRevalidate:B})},!1,A),I)throw b;return await (0,p.I)(U,V,new Response(null,{status:500})),null}}},86439:a=>{"use strict";a.exports=require("next/dist/shared/lib/no-fallback-error.external")},92280:(a,b,c)=>{"use strict";Object.defineProperty(b,"I",{enumerable:!0,get:function(){return g}});let d=c(28208),e=c(47617),f=c(62018);async function g(a,b,c,g){if((0,d.isNodeNextResponse)(b)){var h;b.statusCode=c.status,b.statusMessage=c.statusText;let d=["set-cookie","www-authenticate","proxy-authenticate","vary"];null==(h=c.headers)||h.forEach((a,c)=>{if("x-middleware-set-cookie"!==c.toLowerCase())if("set-cookie"===c.toLowerCase())for(let d of(0,f.splitCookiesString)(a))b.appendHeader(c,d);else{let e=void 0!==b.getHeader(c);(d.includes(c.toLowerCase())||!e)&&b.appendHeader(c,a)}});let{originalResponse:i}=b;c.body&&"HEAD"!==a.method?await (0,e.pipeToNodeResponse)(c.body,i,g):i.end()}}},94735:a=>{"use strict";a.exports=require("events")},96330:a=>{"use strict";a.exports=require("@prisma/client")},96487:()=>{}};var b=require("../../../../webpack-runtime.js");b.C(a);var c=b.X(0,[445,573,172,795],()=>b(b.s=84449));module.exports=c})();