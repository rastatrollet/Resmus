const gids = ['1824714927', '1546724458', '1289357534', '611254'];

Promise.all(gids.map(g => {
    return fetch('https://docs.google.com/spreadsheets/d/e/2PACX-1vRWONg_QEnh0ilutmzdFbLp5PuyNIo__bk1IbpeMe25bT07sexsJcq1eJD5EnW96nCmwQeXbrzvFOrm/pub?gid=' + g + '&single=true&output=csv')
        .then(res => res.text())
        .then(t => {
            console.log("=== GID", g, "===");
            console.log(t.substring(0, 200));
        });
}));
