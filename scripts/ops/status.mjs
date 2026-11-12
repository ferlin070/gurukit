if(!process.env.CRON_SECRET)throw new Error('CRON_SECRET secure binding required.');
const response=await fetch('https://gurukit-rho.vercel.app/api/ops-status',{headers:{Authorization:'Bearer '+process.env.CRON_SECRET},signal:AbortSignal.timeout(15000)});
if(!response.ok)throw new Error('Operations status HTTP '+response.status);
console.log(JSON.stringify(await response.json(),null,2));
