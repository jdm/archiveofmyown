let tag = null;
let pageContent = null;

(async () => {
    // TODO: ensure page query param is absent, always start at first page
    pageContent = document.querySelector('#page-content');
    const [currentTab] =
          await browser.tabs.query({active: true, currentWindow: true});
    if (!currentTab.url.startsWith('https://archiveofourown.org/tags/')) {
        pageContent.innerHTML =
            `To use this extension go to a tag page and then click on the extension icon again`;
    } else {
        const url = new URL(currentTab.url);
        const pathParts = url.pathname.split('/');
        tag = decodeURIComponent(pathParts[2].replace('*s*', '/'));

        const button = document.createElement('button');
        button.textContent = `Archive ${tag}`;
        button.onclick = doArchive;
        pageContent.appendChild(button);
    }
})();

let pages = null;
let currentPage = 0;
let works = [];
let downloadUrls = [];
let downloadIndex = 0;

function updateContent() {
    if (currentPage == pages &&
        downloadUrls.length == works.length &&
        downloadIndex == downloadUrls.length)
    {
        pageContent.innerHTML = `Archiving complete.`;
        return;
    }
    const content = `
<h5>Archiving <u>${tag}</u>...</h5>
<p>Scanned ${currentPage}/${pages != null ? pages : "??"} pages for works.
<p>Retrieved ${downloadUrls.length}/${works.length} download links.
<p>Started ${downloadIndex}/${downloadUrls.length} downloads.
`;
    pageContent.innerHTML = content;
}

setInterval(() => {
    if (downloadIndex == downloadUrls.length) {
        return;
    }
    // TODO: detect failed download and retry.
    const url = downloadUrls[downloadIndex];
    const urlParts = (new URL(url)).pathname.split('/');
    const filename = decodeURIComponent(urlParts[urlParts.length - 1]);
    // TODO: allow configuring destination prefix
    const destination = "archive/" + filename;
    console.log(`Downloading ${url} to ${filename}`);
    browser.downloads.download({
        url: url,
        filename: destination,
        saveAs: false,
    })
        .then(item => console.log(`Started downloading ${url}`))
        .catch(reason => console.error(`Download of ${url} failed: ${reason}`));
    downloadIndex += 1;
    updateContent();
}, 3000);

function doArchive() {
    browser.runtime.onMessage.addListener(message => {
        console.log(`got message ${JSON.stringify(message)}`);
        switch (message.op) {
        case 'pages':
            pages = message.count;
            break;
        case 'page':
            works = works.concat(message.urls);
            currentPage = Math.max(message.pageNum, currentPage);
            break;
        case 'work':
            downloadUrls.push(message.url);
            break;
        }
        updateContent();
    });
    browser.tabs.query({active: true, currentWindow: true})
        .then(([tab]) => browser.tabs.executeScript(tab.id, {file: '/inject.js'}))
        .then(() => console.log("should have executed inject.js"))
        .catch(e => console.error("archive.js: " + e));
    updateContent();
}
