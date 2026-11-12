if(!process.env.CRON_SECRET)throw new Error('CRON_SECRET secure binding required.');
const response=await fetch('https://gurukit-rho.vercel.app/api/operations',{headers:{Authorization:'Bearer '+process.env.CRON_SECRET},signal:AbortSignal.timeout(65000)});
if(!response.ok)throw new Error('Daily operations HTTP '+response.status);
console.log(JSON.stringify(await response.json(),null,2));
