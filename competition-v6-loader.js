/** Load finalized Competition V6 only. Seating chart is intentionally excluded. */
(async function loadCompetitionV6Only(){
  const modules=["competition-v6-category.js","competition-criteria-settings-boot-v6.js","competition-record-sync-v6.js","competition-record-student-picker-v6.js","competition-render-helpers-v6.js","competition-ux-v6.js","competition-record-edit-sync-v6.js","competition-criteria-settings-ux-v6.js","competition-calculation-v6.js","competition-calculation-runtime-v6.js","competition-record-form-v6.js","competition-record-write-boundary-v6.js","competition-ranking-ui-v6.js","competition-legacy-boundary-v6.js","competition-record-form-clean-v6.js","competition-record-date-v6.js","competition-record-edit-date-v6.js","competition-ranking-columns-v6.js","competition-issues-service-v6.js","competition-issues-renderer-v6.js","competition-recalculation-v6.js","competition-snapshot-notification-v6.js","competition-snapshot-edit-v6.js","competition-record-form-final-v6.js"];
  for(const source of modules){
    const id='competition-v6-'+source.replace(/[^a-z0-9]/gi,'-');
    if(document.getElementById(id)) continue;
    await new Promise((resolve,reject)=>{
      const s=document.createElement('script');
      s.id=id; s.src=source; s.defer=true;
      s.onload=resolve; s.onerror=()=>reject(new Error('Không thể nạp '+source));
      document.head.appendChild(s);
    });
  }
})();