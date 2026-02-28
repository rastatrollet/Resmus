async function run() {
    const sl = await fetch('https://docs.google.com/spreadsheets/d/e/2PACX-1vRWONg_QEnh0ilutmzdFbLp5PuyNIo__bk1IbpeMe25bT07sexsJcq1eJD5EnW96nCmwQeXbrzvFOrm/pub?gid=617657268&single=true&output=csv').then(r => r.text());
    console.log("--- SL ---");
    console.log(sl.split('\n').slice(0, 15).join('\n'));

    const skane = await fetch('https://docs.google.com/spreadsheets/d/e/2PACX-1vRWONg_QEnh0ilutmzdFbLp5PuyNIo__bk1IbpeMe25bT07sexsJcq1eJD5EnW96nCmwQeXbrzvFOrm/pub?gid=1024044367&single=true&output=csv').then(r => r.text());
    console.log("--- Skane ---");
    console.log(skane.split('\n').slice(0, 15).join('\n'));
}
run();
