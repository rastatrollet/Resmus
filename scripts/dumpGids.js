const url = "https://docs.google.com/spreadsheets/d/e/2PACX-1vRWONg_QEnh0ilutmzdFbLp5PuyNIo__bk1IbpeMe25bT07sexsJcq1eJD5EnW96nCmwQeXbrzvFOrm/pub?html=true";

fetch(url)
    .then(res => res.text())
    .then(text => {
        let lines = text.split("items.push(");
        for (let i = 1; i < lines.length; i++) {
            let line = lines[i].split(");")[0];
            console.log(line);
        }
    });
