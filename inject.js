(function() {
    if (typeof hasBeenInjected !== "undefined") {
        return;
    }
    hasBeenInjected = true;

    console.log("injected");
    if (typeof(browser) === "undefined") {
        browser = chrome;
    }

    let works = [];
    let nextWorkTimeout = null;
    let nextPageTimeout = null;

    function retrieveWorksFromPage(document, pageNumber) {
        const works = document.querySelectorAll(".work li.work");
        let workUrls = [];
        for (const work of works) {
            const id = work.id.split("_")[1];
            const url = `https://archiveofourown.org/works/${id}`;
            workUrls.push(url);
        }
        browser.runtime.sendMessage({
            op: 'page',
            urls: workUrls,
            pageNum: pageNumber,
        });
        return workUrls;
    }

    function handleWork(document, format) {
        console.log("fetching download URL");
        const downloadButton = document.querySelector(`.download .expandable > li:nth-child(${format}) > a:nth-child(1)`);
        browser.runtime.sendMessage({
            'op': 'work',
            'url': downloadButton.href.toString(),
        });
    }

    function fetchPage(url, handler) {
        url += "?view_adult=true";
        console.log(`fetching ${url}`);
        return fetch(url)
            .then(response => {
                if (!response.ok) {
                    const retryAfter = response.headers.get('retry-after');
                    throw retryAfter;
                }
                return response.text()
            })
            .then(text => {
                console.log(`parsing ${url}`);
                const parser = new DOMParser();
                const doc = parser.parseFromString(text, "text/html");
                handler(doc);
            })
    }

    function handleTagPage(document, pageNum) {
        console.log(`retrieving all works for page ${pageNum}`);
        works = works.concat(retrieveWorksFromPage(document, pageNum));
    }

    function beginArchiving(format) {
        console.log("Starting archival process.");

        let baseTagPage = new URL(location.href);
        const nextPageElem = document.querySelector('.pagination .next');
        const pages = nextPageElem ? nextPageElem.previousElementSibling : null;
        const numPages = pages ? parseInt(pages.textContent) : 1;
        browser.runtime.sendMessage({
            op: "pages",
            count: numPages,
        });

        const defaultFetchTimeout = 200;
        let workFetchTimeout = defaultFetchTimeout;
        nextWorkTimeout = setTimeout(function fetchNextWork() {
            const work = works.shift();
            if (!work) {
                nextWorkTimeout = setTimeout(fetchNextWork, workFetchTimeout);
                return;
            }
            fetchPage(work, (doc) => handleWork(doc, format))
                .then(() => workFetchTimeout = defaultFetchTimeout)
                .catch(error => {
                    console.log(`${error}: ${work} failed, re-adding to the queue.`);
                    works.push(work);
                    const retryAfter = parseInt(error);
                    if (retryAfter) {
                        const retryAfterMs = retryAfter * 1000 + 100;
                        console.log(`Delaying retry for ${retryAfterMs}ms`);
                        browser.runtime.sendMessage({
                            op: 'throttled',
                            throttledFor: retryAfterMs,
                        });
                        workFetchTimeout = retryAfterMs;
                    } else {
                        workFetchTimeout *= 2;
                    }
                })
                .finally(() => nexWorkTimeout = setTimeout(fetchNextWork, workFetchTimeout));
        }, defaultFetchTimeout);

        // If we're looking at any tag page which is not the first one, we need to fetch
        // the first one.
        const startPage = baseTagPage.searchParams.get("page");
        let nextPage;
        if (startPage != null && startPage != "1") {
            nextPage = 1;
        } else {
            // We can use the current page contents without waiting for it to be fetched.
            handleTagPage(document, 1);
            nextPage = 2;
        }

        let tagFetchTimeout = defaultFetchTimeout;
        nextPageTimeout = setTimeout(function fetchNextTagPage() {
            if (nextPage > numPages) {
                nextPageTimeout = setTimeout(fetchNextTagPage, tagFetchTimeout);
                return;
            }
            fetchingPage = nextPage;
            nextPage += 1;
            baseTagPage.searchParams.set("page", fetchingPage);
            fetchPage(baseTagPage.toString(), (doc) => handleTagPage(doc, fetchingPage))
                .then(() => tagFetchTimeout = defaultFetchTimeout)
                .catch(error => {
                    // If we fail to fetch a page of works, we'll just keep retrying
                    // until it succeeeds.
                    nextPage -= 1;
                    const retryAfter = parseInt(error);
                    if (retryAfter) {
                        const retryAfterMs = retryAfter * 1000 + 100;
                        console.log(`Delaying retry for ${retryAfterMs}ms`);
                        browser.runtime.sendMessage({
                            op: 'throttled',
                            throttledFor: retryAfterMs,
                        });
                        tagFetchTimeout = retryAfterMs;
                    } else {
                        tagFetchTimeout *= 2;
                    }
                })
                .finally(() => nextPageTimeout = setTimeout(fetchNextTagPage, tagFetchTimeout));
        }, defaultFetchTimeout);
    }

    browser.runtime.onMessage.addListener(message => {
        switch (message.type) {
        case 'begin':
            beginArchiving(message.format);
            break;
        case 'stop':
            works = [];
            numPages = 0;
            if (nextWorkTimeout !== null) {
                clearTimeout(nextWorkTimeout);
                nextWorkTimeout = null;
            }
            if (nextPageTimeout !== null) {
                clearTimeout(nextPageTimeout);
                nextPageTimeout = null;
            }
            break;
        }
        return false;
    });
}());
