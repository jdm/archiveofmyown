function updateWorks(pageNum, urls) {
    browser.storage.local.get({ "works": [], "currentPage": 0 })
        .then(({ works, currentPage }) => {
            return browser.storage.local.set({
                "works": works.concat(urls),
                "currentPage": Math.max(currentPage, pageNum),
            })
        })
}

function updateDownloads(url) {
    browser.storage.local.get({ "downloadUrls": [] })
        .then(({ downloadUrls }) => {
            return browser.storage.local.set({
                "downloadUrls": downloadUrls.concat([url]),
            })
        })
}

function reset() {
    browser.storage.local.set({
        "pages": null,
        "currentPage": 0,
        "downloadUrls": [],
        "downloadIndex": 0,
        "works": [],
        "archiving": false,
    })
}

browser.runtime.onMessage.addListener(message => {
    console.log(`got message ${JSON.stringify(message)}`);
    switch (message.op) {
    case 'reset':
        reset();
        break;
    case 'pages':
        browser.storage.local.set({ "pages": message.count });
        break;
    case 'page':
        updateWorks(message.pageNum, message.urls)
        break;
    case 'work':
        updateDownloads(message.url);
        break;
    }
});

function downloadFile(downloadIndex, downloadUrls, downloadPrefix) {
    if (downloadIndex >= downloadUrls.length) {
        return false;
    }
    // TODO: detect failed download and retry.
    const url = downloadUrls[downloadIndex];
    const urlParts = (new URL(url)).pathname.split('/');
    const filename = decodeURIComponent(urlParts[urlParts.length - 1]);
    // TODO: allow configuring destination prefix
    const destination = "archive/" + filename;
    console.log(`Downloading ${url} to ${destination}`);
    browser.downloads.download({
        url: url,
        filename: destination,
        saveAs: false,
    })
        .then(item => console.log(`Started downloading ${url}`))
        .catch(reason => console.error(`Download of ${url} failed: ${reason}`));
    return true;
}

setInterval(() => {
    browser.storage.local.get({ "downloadIndex": 0, "downloadUrls": [] })
        .then(({ downloadIndex, downloadUrls }) => {
            // TODO: get prefix from popup configuration
            if (downloadFile(downloadIndex, downloadUrls, "archive/")) {
                return browser.storage.local.set({ "downloadIndex": downloadIndex + 1 });
            }
        })
}, 3000);
