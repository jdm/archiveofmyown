(function() {
    let works = [];

    function retrieveWorksFromPage(document, pageNumber) {
        const works = document.querySelectorAll(".work li.work");
        let workUrls = [];
        for (const work of works) {
            const id = work.id.split("_")[1];
            const url = `https://archiveofourown.org/works/${id}`;
            workUrls.push(url);
        }
        chrome.runtime.sendMessage({
            op: 'page',
            urls: workUrls,
            pageNum: pageNumber,
        });
        return workUrls;
    }

    function handleWork(document, format) {
        console.log("fetching download URL");
        const downloadButton = document.querySelector(`.download .expandable > li:nth-child(${format}) > a:nth-child(1)`);
        chrome.runtime.sendMessage({
            'op': 'work',
            'url': downloadButton.href.toString(),
        });
    }

    function fetchPage(url, handler) {
        console.log(`fetching ${url}`);
        fetch(url)
            .then(response => response.text())
            .then(text => {
                console.log(`parsing ${url}`);
                // TODO: detect "retry later" message
                const parser = new DOMParser();
                const doc = parser.parseFromString(text, "text/html");
                handler(doc);
            })
    }

    function handleTagPage(document, pageNum) {
        console.log(`retrieving all works for page ${pageNum}`);
        works = works.concat(retrieveWorksFromPage(document, pageNum));
    }

    let pageInterval = null;
    let worksInterval = null;
    function beginArchiving(format) {
        console.log("Starting archival process.");

        let baseTagPage = new URL(location.href);
        const nextPageElem = document.querySelector('.pagination .next');
        const pages = nextPageElem ? nextPageElem.previousElementSibling : null;
        const numPages = pages ? parseInt(pages.textContent) : 1;
        chrome.runtime.sendMessage({
            op: "pages",
            count: numPages,
        });

        worksInterval = setInterval(() => {
            if (works.length === 0) {
                return;
            }
            // TODO: retry if failed.
            fetchPage(works.shift(), (doc) => handleWork(doc, format));
        }, 2000);

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

        pageInterval = setInterval(() => {
            if (nextPage > numPages) {
                return;
            }
            // TODO: retry if failed.
            const page = nextPage;
            nextPage += 1;
            baseTagPage.searchParams.set("page", page);
            fetchPage(baseTagPage.toString(), (doc) => handleTagPage(doc, page));
        }, 3000);

    }

    chrome.runtime.onMessage.addListener(message => {
        switch (message.type) {
        case 'begin':
            beginArchiving(message.format);
            break;
        case 'stop':
            if (pageInterval != null) {
                clearInterval(pageInterval);
            }
            if (worksInterval != null) {
                clearInterval(worksInterval);
            }
            break;
        }
    });
}());
