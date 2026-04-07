"use strict";(()=>{var a={};a.id=442,a.ids=[442],a.modules={261:a=>{a.exports=require("next/dist/shared/lib/router/utils/app-paths")},1932:a=>{a.exports=require("url")},3295:a=>{a.exports=require("next/dist/server/app-render/after-task-async-storage.external.js")},9942:(a,b,c)=>{c.r(b),c.d(b,{handler:()=>F,patchFetch:()=>E,routeModule:()=>A,serverHooks:()=>D,workAsyncStorage:()=>B,workUnitAsyncStorage:()=>C});var d={};c.r(d),c.d(d,{GET:()=>z});var e=c(19225),f=c(84006),g=c(8317),h=c(99373),i=c(34775),j=c(24235),k=c(261),l=c(54365),m=c(90771),n=c(73461),o=c(67798),p=c(92280),q=c(62018),r=c(45696),s=c(47929),t=c(86439),u=c(37527),v=c(23211),w=c(94468),x=c(90782),y=c(93536);async function z(a){try{if(!await (0,y.Km)())return new v.NextResponse(`<!DOCTYPE html><html><head><title>Access Denied</title></head>
        <body style="background:#0a0e17;color:#ff4444;font-family:sans-serif;display:flex;align-items:center;justify-content:center;height:100vh;margin:0">
          <div style="text-align:center">
            <h2>❌ Admin access required</h2>
            <p>Only admin can connect Fyers.</p>
            <script>setTimeout(()=>window.location.href='/',2500)</script>
          </div>
        </body></html>`,{headers:{"Content-Type":"text/html"}});let b=a.nextUrl.searchParams,c=b.get("auth_code"),d=b.get("s");if("error"===d||"nok"===d||!c)return new v.NextResponse(`<!DOCTYPE html><html><head><title>Login Failed</title></head>
        <body style="background:#0a0e17;color:#ff4444;font-family:sans-serif;display:flex;align-items:center;justify-content:center;height:100vh;margin:0">
          <div style="text-align:center">
            <h2>❌ Fyers Login Failed</h2>
            <p>Please try again.</p>
            <script>setTimeout(()=>window.location.href='/',3000)</script>
          </div>
        </body></html>`,{headers:{"Content-Type":"text/html"}});let e=new w.s,f=await e.validateAuthCode(c);return await (0,x.q)(f),new v.NextResponse(`<!DOCTYPE html><html><head><title>Connecting...</title></head>
      <body style="background:#0a0e17;color:#00e676;font-family:sans-serif;display:flex;align-items:center;justify-content:center;height:100vh;margin:0">
        <div style="text-align:center">
          <h2>✅ Fyers Connected Successfully!</h2>
          <p>Redirecting to dashboard...</p>
          <script>
            localStorage.setItem('fyers_access_token', '${f}');
            window.location.href = '/?connected=true';
          </script>
        </div>
      </body></html>`,{headers:{"Content-Type":"text/html"}})}catch(a){return console.error("Fyers Callback Error:",a.message),new v.NextResponse(`<!DOCTYPE html><html><head><title>Login Failed</title></head>
      <body style="background:#0a0e17;color:#ff4444;font-family:sans-serif;display:flex;align-items:center;justify-content:center;height:100vh;margin:0">
        <div style="text-align:center">
          <h2>❌ Fyers Login Failed</h2>
          <p>${a.message||"Unknown error"}</p>
          <script>setTimeout(()=>window.location.href='/',3000)</script>
        </div>
      </body></html>`,{headers:{"Content-Type":"text/html"}})}}let A=new e.AppRouteRouteModule({definition:{kind:f.RouteKind.APP_ROUTE,page:"/api/auth/callback/route",pathname:"/api/auth/callback",filename:"route",bundlePath:"app/api/auth/callback/route"},distDir:".next",relativeProjectDir:"",resolvedPagePath:"C:\\Users\\Admin\\Desktop\\Paper-Trading-Web-APP\\src\\app\\api\\auth\\callback\\route.ts",nextConfigOutput:"",userland:d}),{workAsyncStorage:B,workUnitAsyncStorage:C,serverHooks:D}=A;function E(){return(0,g.patchFetch)({workAsyncStorage:B,workUnitAsyncStorage:C})}async function F(a,b,c){c.requestMeta&&(0,h.setRequestMeta)(a,c.requestMeta),A.isDev&&(0,h.addRequestMeta)(a,"devRequestTimingInternalsEnd",process.hrtime.bigint());let d="/api/auth/callback/route";"/index"===d&&(d="/");let e=await A.prepare(a,b,{srcPage:d,multiZoneDraftMode:!1});if(!e)return b.statusCode=400,b.end("Bad Request"),null==c.waitUntil||c.waitUntil.call(c,Promise.resolve()),null;let{buildId:g,params:v,nextConfig:w,parsedUrl:x,isDraftMode:y,prerenderManifest:z,routerServerContext:B,isOnDemandRevalidate:C,revalidateOnlyGenerated:D,resolvedPathname:E,clientReferenceManifest:F,serverActionsManifest:G}=e,H=(0,k.normalizeAppPath)(d),I=!!(z.dynamicRoutes[H]||z.routes[E]),J=async()=>((null==B?void 0:B.render404)?await B.render404(a,b,x,!1):b.end("This page could not be found"),null);if(I&&!y){let a=!!z.routes[E],b=z.dynamicRoutes[H];if(b&&!1===b.fallback&&!a){if(w.adapterPath)return await J();throw new t.NoFallbackError}}let K=null;!I||A.isDev||y||(K="/index"===(K=E)?"/":K);let L=!0===A.isDev||!I,M=I&&!L;G&&F&&(0,j.setManifestsSingleton)({page:d,clientReferenceManifest:F,serverActionsManifest:G});let N=a.method||"GET",O=(0,i.getTracer)(),P=O.getActiveScopeSpan(),Q=!!(null==B?void 0:B.isWrappedByNextServer),R=!!(0,h.getRequestMeta)(a,"minimalMode"),S=(0,h.getRequestMeta)(a,"incrementalCache")||await A.getIncrementalCache(a,w,z,R);null==S||S.resetRequestCache(),globalThis.__incrementalCache=S;let T={params:v,previewProps:z.preview,renderOpts:{experimental:{authInterrupts:!!w.experimental.authInterrupts},cacheComponents:!!w.cacheComponents,supportsDynamicResponse:L,incrementalCache:S,cacheLifeProfiles:w.cacheLife,waitUntil:c.waitUntil,onClose:a=>{b.on("close",a)},onAfterTaskError:void 0,onInstrumentationRequestError:(b,c,d,e)=>A.onRequestError(a,b,d,e,B)},sharedContext:{buildId:g}},U=new l.NodeNextRequest(a),V=new l.NodeNextResponse(b),W=m.NextRequestAdapter.fromNodeNextRequest(U,(0,m.signalFromNodeResponse)(b));try{let e,g=async a=>A.handle(W,T).finally(()=>{if(!a)return;a.setAttributes({"http.status_code":b.statusCode,"next.rsc":!1});let c=O.getRootSpanAttributes();if(!c)return;if(c.get("next.span_type")!==n.BaseServerSpan.handleRequest)return void console.warn(`Unexpected root span type '${c.get("next.span_type")}'. Please report this Next.js issue https://github.com/vercel/next.js`);let f=c.get("next.route");if(f){let b=`${N} ${f}`;a.setAttributes({"next.route":f,"http.route":f,"next.span_name":b}),a.updateName(b),e&&e!==a&&(e.setAttribute("http.route",f),e.updateName(b))}else a.updateName(`${N} ${d}`)}),h=async e=>{var h,i;let j=async({previousCacheEntry:f})=>{try{if(!R&&C&&D&&!f)return b.statusCode=404,b.setHeader("x-nextjs-cache","REVALIDATED"),b.end("This page could not be found"),null;let d=await g(e);a.fetchMetrics=T.renderOpts.fetchMetrics;let h=T.renderOpts.pendingWaitUntil;h&&c.waitUntil&&(c.waitUntil(h),h=void 0);let i=T.renderOpts.collectedTags;if(!I)return await (0,p.I)(U,V,d,T.renderOpts.pendingWaitUntil),null;{let a=await d.blob(),b=(0,q.toNodeOutgoingHttpHeaders)(d.headers);i&&(b[s.NEXT_CACHE_TAGS_HEADER]=i),!b["content-type"]&&a.type&&(b["content-type"]=a.type);let c=void 0!==T.renderOpts.collectedRevalidate&&!(T.renderOpts.collectedRevalidate>=s.INFINITE_CACHE)&&T.renderOpts.collectedRevalidate,e=void 0===T.renderOpts.collectedExpire||T.renderOpts.collectedExpire>=s.INFINITE_CACHE?void 0:T.renderOpts.collectedExpire;return{value:{kind:u.CachedRouteKind.APP_ROUTE,status:d.status,body:Buffer.from(await a.arrayBuffer()),headers:b},cacheControl:{revalidate:c,expire:e}}}}catch(b){throw(null==f?void 0:f.isStale)&&await A.onRequestError(a,b,{routerKind:"App Router",routePath:d,routeType:"route",revalidateReason:(0,o.c)({isStaticGeneration:M,isOnDemandRevalidate:C})},!1,B),b}},k=await A.handleResponse({req:a,nextConfig:w,cacheKey:K,routeKind:f.RouteKind.APP_ROUTE,isFallback:!1,prerenderManifest:z,isRoutePPREnabled:!1,isOnDemandRevalidate:C,revalidateOnlyGenerated:D,responseGenerator:j,waitUntil:c.waitUntil,isMinimalMode:R});if(!I)return null;if((null==k||null==(h=k.value)?void 0:h.kind)!==u.CachedRouteKind.APP_ROUTE)throw Object.defineProperty(Error(`Invariant: app-route received invalid cache entry ${null==k||null==(i=k.value)?void 0:i.kind}`),"__NEXT_ERROR_CODE",{value:"E701",enumerable:!1,configurable:!0});R||b.setHeader("x-nextjs-cache",C?"REVALIDATED":k.isMiss?"MISS":k.isStale?"STALE":"HIT"),y&&b.setHeader("Cache-Control","private, no-cache, no-store, max-age=0, must-revalidate");let l=(0,q.fromNodeOutgoingHttpHeaders)(k.value.headers);return R&&I||l.delete(s.NEXT_CACHE_TAGS_HEADER),!k.cacheControl||b.getHeader("Cache-Control")||l.get("Cache-Control")||l.set("Cache-Control",(0,r.getCacheControlHeader)(k.cacheControl)),await (0,p.I)(U,V,new Response(k.value.body,{headers:l,status:k.value.status||200})),null};Q&&P?await h(P):(e=O.getActiveScopeSpan(),await O.withPropagatedContext(a.headers,()=>O.trace(n.BaseServerSpan.handleRequest,{spanName:`${N} ${d}`,kind:i.SpanKind.SERVER,attributes:{"http.method":N,"http.target":a.url}},h),void 0,!Q))}catch(b){if(b instanceof t.NoFallbackError||await A.onRequestError(a,b,{routerKind:"App Router",routePath:H,routeType:"route",revalidateReason:(0,o.c)({isStaticGeneration:M,isOnDemandRevalidate:C})},!1,B),I)throw b;return await (0,p.I)(U,V,new Response(null,{status:500})),null}}},10846:a=>{a.exports=require("next/dist/compiled/next-server/app-page.runtime.prod.js")},11723:a=>{a.exports=require("querystring")},12412:a=>{a.exports=require("assert")},21820:a=>{a.exports=require("os")},27910:a=>{a.exports=require("stream")},28354:a=>{a.exports=require("util")},29021:a=>{a.exports=require("fs")},29294:a=>{a.exports=require("next/dist/server/app-render/work-async-storage.external.js")},33873:a=>{a.exports=require("path")},44870:a=>{a.exports=require("next/dist/compiled/next-server/app-route.runtime.prod.js")},55511:a=>{a.exports=require("crypto")},55591:a=>{a.exports=require("https")},63033:a=>{a.exports=require("next/dist/server/app-render/work-unit-async-storage.external.js")},69541:(a,b,c)=>{c.d(b,{$4:()=>g,BK:()=>y,Bj:()=>v,Ck:()=>w,Fl:()=>f,Jx:()=>i,Zb:()=>h,nc:()=>u,u6:()=>x});var d=c(20903),e=c(78930);let f={canPlaceOrder:!0,canExitPosition:!0,canModifySLTarget:!0,canCancelOrder:!0,canViewReports:!0},g={canPlaceOrder:!0,canExitPosition:!0,canModifySLTarget:!0,canCancelOrder:!0,canViewReports:!0},h={maxOpenPositions:5,maxOrderQuantity:900,maxDailyLoss:5e4,maxOrderNotional:5e6},i={maxOpenPositions:100,maxOrderQuantity:1e5,maxDailyLoss:1e8,maxOrderNotional:1e9},j=null;function k(a,b,c,d){let e=Number(a);return Number.isFinite(e)?Math.min(d,Math.max(c,e)):b}function l(a){if(!a)return{};if("string"==typeof a)try{let b=JSON.parse(a);return b&&"object"==typeof b?b:{}}catch{return{}}return"object"==typeof a?a:{}}function m(a,b){return(0,e.K)(b)||"ADMIN"===String(a||"").toUpperCase()?"ADMIN":"USER"}function n(a,b){return(0,e.K)(b)?"ACTIVE":"DISABLED"===String(a||"").toUpperCase()?"DISABLED":"ACTIVE"}function o(a,b){let c=l(a),d="ADMIN"===b?g:f;return{canPlaceOrder:"boolean"==typeof c.canPlaceOrder?c.canPlaceOrder:d.canPlaceOrder,canExitPosition:"boolean"==typeof c.canExitPosition?c.canExitPosition:d.canExitPosition,canModifySLTarget:"boolean"==typeof c.canModifySLTarget?c.canModifySLTarget:d.canModifySLTarget,canCancelOrder:"boolean"==typeof c.canCancelOrder?c.canCancelOrder:d.canCancelOrder,canViewReports:"boolean"==typeof c.canViewReports?c.canViewReports:d.canViewReports}}function p(a,b){let c=l(a),d="ADMIN"===b?i:h;return{maxOpenPositions:Math.floor(k(c.maxOpenPositions,d.maxOpenPositions,1,1e3)),maxOrderQuantity:Math.floor(k(c.maxOrderQuantity,d.maxOrderQuantity,1,1e6)),maxDailyLoss:k(c.maxDailyLoss,d.maxDailyLoss,1e3,1e9),maxOrderNotional:k(c.maxOrderNotional,d.maxOrderNotional,1e4,1e10)}}function q(a,b){let c=(0,e.K)(b)?"ADMIN":"USER",d=new Date;return{userId:a,role:c,status:"ACTIVE",permissions:"ADMIN"===c?g:f,riskLimits:"ADMIN"===c?i:h,createdAt:d,updatedAt:d}}function r(a,b){let c=m(a.role,b),d=n(a.status,b);return{userId:a.userId,role:c,status:d,permissions:o(a.permissions,c),riskLimits:p(a.riskLimits,c),createdAt:a.createdAt,updatedAt:a.updatedAt}}async function s(){if(j)return j;j=(async()=>{await d.A.$executeRawUnsafe(`
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
  `).map(a=>({id:a.id,actorUserId:a.actorUserId,actorEmail:a.actorEmail,targetUserId:a.targetUserId,action:a.action,details:l(a.details),createdAt:a.createdAt}))}},73496:a=>{a.exports=require("http2")},74075:a=>{a.exports=require("zlib")},78930:(a,b,c)=>{c.d(b,{K:()=>d});function d(a){let b,c=(b=(process.env.ADMIN_EMAIL||process.env.NEXT_PUBLIC_ADMIN_EMAIL||"").trim().toLowerCase()).length>0?b:null;return!!c&&!!a&&a.trim().toLowerCase()===c}},79428:a=>{a.exports=require("buffer")},81630:a=>{a.exports=require("http")},83997:a=>{a.exports=require("tty")},86439:a=>{a.exports=require("next/dist/shared/lib/no-fallback-error.external")},90782:(a,b,c)=>{c.d(b,{i:()=>k,q:()=>j});var d=c(20903);let e="FYERS",f=null,g=null;function h(a){let b=a?.trim();return b&&b.length>0?b:null}async function i(){if(g)return g;g=d.A.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "SharedBrokerState" (
      "provider" TEXT PRIMARY KEY,
      "accessToken" TEXT,
      "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `).then(()=>void 0);try{await g}catch(a){throw g=null,a}}async function j(a){let b=h(a);f=b;try{await i(),await d.A.$executeRaw`
      INSERT INTO "SharedBrokerState" ("provider", "accessToken", "updatedAt")
      VALUES (${e}, ${b}, NOW())
      ON CONFLICT ("provider")
      DO UPDATE SET
        "accessToken" = EXCLUDED."accessToken",
        "updatedAt" = NOW()
    `}catch(a){console.error("Shared Fyers token persistence failed:",a)}}async function k(){if(f)return f;try{await i();let a=await d.A.$queryRaw`
      SELECT "accessToken"
      FROM "SharedBrokerState"
      WHERE "provider" = ${e}
      LIMIT 1
    `,b=h(a[0]?.accessToken);return f=b,b}catch(a){return console.error("Shared Fyers token load failed:",a),null}}},93536:(a,b,c)=>{c.d(b,{GC:()=>j,Km:()=>i});var d=c(50172),e=c(20903),f=c(69541);async function g(){let a=await (0,d.getServerSession)(),b=a?.user;return b?(b.id?await e.A.user.findUnique({where:{id:b.id},select:{id:!0,email:!0,name:!0}}):b.email?await e.A.user.findUnique({where:{email:b.email},select:{id:!0,email:!0,name:!0}}):null)??null:null}async function h(){let a=await g();if(!a)return null;let b=await (0,f.nc)(a.id,a.email);return"DISABLED"===b.status?null:{userId:a.id,user:a,access:b}}async function i(){let a=await h();return a&&"ADMIN"===a.access.role?a:null}async function j(){let a=await h();if(!a)return null;let{userId:b}=a,c=await e.A.account.findFirst({where:{userId:b},orderBy:{createdAt:"desc"}});if(c)return{...a,account:c};let d=await e.A.account.create({data:{userId:b,name:"Default",balance:1e6,initialBalance:1e6}});return{...a,account:d}}},94735:a=>{a.exports=require("events")},96330:a=>{a.exports=require("@prisma/client")}};var b=require("../../../../webpack-runtime.js");b.C(a);var c=b.X(0,[445,813,573,172,751,540],()=>b(b.s=9942));module.exports=c})();