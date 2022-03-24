const server_url = "https://bidmoore-staging.herokuapp.com/api/v1";
const socketUrl = "wss://bidmoore-staging.herokuapp.com";
const auctionsRow = `<div class="cards">AUCTIONS</div>`
const auctionBody = `
<div class="auctionHeader">
<h5 class="auctionName">PRODUCT_NAME</h5>
<p class="auctionPrice">
    ₦DISCOUNT_PRICE <del>₦PRODUCT_PRICE</del>
</p>
</div>
<div class="AuctionImage">
<div class="auction_image">
    <img src="IMAGE_SRC" class="auctionItem" />
</div>
<div class="subsinfo">
    <h6 class="subsCharge">
        BID_CHARGE<img src="image folder/coin.svg" class="coinCharge" />
        <span class="per">/</span>bid
    </h6>

    <h6 class="subsCharge">Up to 90%</h6>
</div>
</div>
<div class="AuctionTime">
<h5 class="time-Text COUNT_DOWN_L" time=ACTUAL_TIME>MESSAGE_OR_TIME</h5>
<h5 class="start__time COUNT_DOWN_U" time=ACTUAL_TIME>TIME_OR_PRICE</h5>
</div>
<div class="currentSub">
<h5 class="username">USERNAME</h5>
<p class="subStatus">MESSAGE</p>
</div>
<button class="sub_button" onclick="CLICK_FUNCTION" DISABLE_BTN>
BUTTON_MESSAGE
</button>
`;
const auctionCard = `<div class="Auctioncard" id="AUCTIONID">AUCTION_BODY</div>`;

let liveAuctionsSection;
let upcomingAuctionsSection;
let socket;
let token;
let username;

document.addEventListener('DOMContentLoaded', () => {
    const params = window.location.pathname.split('/');
    console.log(params);
    if (params.length < 2) window.location.href = "https://bidmoore-staging.web.app/";
    liveAuctionsSection = document.getElementById('liveAuctions');
    upcomingAuctionsSection = document.getElementById('upcomingAuctions');
    connect(params[1]);
    token = params[1];
});

const requestOptions = {
    method: 'GET',
    redirect: 'follow'
};

function topup() {
    console.log('here');
    fetch(`${server_url}/user/deposit`, {
        method: 'POST',
        headers: new Headers({
            'Authorization': `Bearer ${token}`,
            'Accept': 'application/json',
            'Content-Type': 'application/json'
        }),
        body: JSON.stringify({ amount: 20000 })
    })
    .then(response => response.text())
    .then(result => {
        let res = JSON.parse(result);
        let { balance } = res.data[0];
        document.getElementById('coin').innerText = commaSeperate(balance);
    })
    .catch(error => {
        console.log(error);
    });
}

const sendBid = (auctionId) => {
    socket.emit('bid:server', { auctionId });
}

const sendSub = (auctionId) => {
    socket.emit('sub:server', { auctionId });
}

function commaSeperate(num) {
    return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}

function parseTime(time) {
    time = Math.floor(time / 1000);
    let hours = Math.floor(time / (60*60));
    let minutes = Math.floor(time / 60) - (hours * 60);
    let seconds = time - (hours*60*60) - (minutes * 60);
    let hourStr = hours > 0 ? `${hours}h`: "";
    let minuteStr = minutes > 0 ? `${minutes}m`: "";
    return `${hourStr}${minuteStr}${seconds}s`
}

function updateLiveAuction(auction) {
    let auctionDOM = document.getElementById(auction.auctionId);
    if (auctionDOM) {
        auctionDOM.innerHTML = addLDetails(auction);
    }
}

function addLDetails(auction) {
    const { 
        auctionId, product: { name, price, image } , discountPrice, currentPrice,
        bidCost, subCharge, lastBidder, status, endTime, subscriptions,
    } = auction;
    let time = (new Date(endTime)) - (new Date());
    let subscribed = subscriptions.includes(username);
    return auctionBody
            .replace(/ACTUAL_TIME/g, time)
            .replace(/MESSAGE_OR_TIME/, status === "LIVE" ? parseTime(time): "ENDED AT")
            .replace(/COUNT_DOWN_L/, status === "LIVE" ? `time` : "" )
            .replace(/TIME_OR_PRICE/, currentPrice ? commaSeperate(currentPrice) : 0)
            .replace(/DISABLE_BTN/g, status === "LIVE" ? "" : "disabled")
            .replace(/BUTTON_MESSAGE/, status === "LIVE" ? (subscribed ? "BID NOW" : "Subscribe for SUB_CHARGEc") : "AUCTION ENDED")
            .replace(/PRODUCT_NAME/g, name)
            .replace(/DISCOUNT_PRICE/g, commaSeperate(discountPrice))
            .replace(/PRODUCT_PRICE/g, commaSeperate(price))
            .replace(/IMAGE_SRC/g, image)
            .replace(/BID_CHARGE/g, bidCost)
            .replace(/SUB_CHARGE/g, subCharge)
            .replace(/USERNAME/, lastBidder ? lastBidder.username : "NO")
            .replace(/MESSAGE/,  lastBidder ? (status === "LIVE" ? "IS WINNNING" : "HAS WON") : "BIDS")
            .replace(/CLICK_FUNCTION/, subscribed ? `sendBid('${auctionId}')` : `sendSub('${auctionId}')`);
}

function updateSubAuction(auction) {
    const { auctionId, status } = auction;
    let auctionDOM = document.getElementById(auctionId);
    if (auctionDOM) {
        auctionDOM.innerHTML =  (status !== "UPCOMING") ? addLDetails(auction) : addUDetails(auction);
    }
}

function addUDetails(auction) {
    const {
        auctionId, product: { name, price, image },
        discountPrice, bidCost, subCharge, subscriptions, startTime,
    } = auction;
    let subscribed = subscriptions.includes(username);
    let time = (new Date(startTime)) - (new Date());
    return auctionBody
        .replace(/ACTUAL_TIME/g, time)
        .replace(/COUNT_DOWN_U/, `time`)
        .replace(/MESSAGE_OR_TIME/, "BIDDING STARTS")
        .replace(/TIME_OR_PRICE/, parseTime(time))
        .replace(/BUTTON_MESSAGE/, subscribed ? "Already Subscribed" : "Subscribe for SUB_CHARGEc")
        .replace(/PRODUCT_NAME/g, name)
        .replace(/DISCOUNT_PRICE/g, commaSeperate(discountPrice))
        .replace(/PRODUCT_PRICE/g, commaSeperate(price))
        .replace(/IMAGE_SRC/g, image)
        .replace(/BID_CHARGE/g, bidCost)
        .replace(/SUB_CHARGE/g, subCharge)
        .replace(/USERNAME/, subscriptions[0] ? subscriptions[0] : "NO")
        .replace(/MESSAGE/, subscriptions[0] ? "JUST SUBSCRIBED" : "SUBSCRIPTIONS")
        .replace(/DISABLE_BTN/g, subscribed ? "disabled" : "")
        .replace(/CLICK_FUNCTION/, `sendSub('${auctionId}')`);
}

function updateAuctions({ liveAuctions, upcomingAuctions }) {
    let strLAuctions = ``;
    for (let auction of liveAuctions) {
        const { auctionId } = auction;
        let cardDetails = addLDetails(auction)
        let card = auctionCard.replace(/AUCTIONID/g, auctionId)
            .replace(/AUCTION_BODY/, cardDetails);
        strLAuctions = `${strLAuctions}\n ${card}`;
    }
    let strUAuctions = ``;
    for (let auction of upcomingAuctions) {
        const { auctionId } = auction;
        let cardDetails = addUDetails(auction)
        let card = auctionCard.replace(/AUCTIONID/g, auctionId)
            .replace(/AUCTION_BODY/, cardDetails);
        strUAuctions = `${strUAuctions}\n ${card}`;
    }
    liveAuctionsSection.innerHTML = auctionsRow.replace(/AUCTIONS/, strLAuctions);
    upcomingAuctionsSection.innerHTML = auctionsRow.replace(/AUCTIONS/, strUAuctions);
}

function fetchAuctions() {
    fetch(`${server_url}/auctions`, requestOptions)
        .then(response => response.text())
        .then(result => {
            let res = JSON.parse(result);
            let { liveAuctions, upcomingAuctions } = res.data[0];
            console.log('live', liveAuctions);
            console.log('upcoming', upcomingAuctions);
            updateAuctions({ liveAuctions, upcomingAuctions });
        })
        .catch(error => {
            console.log(error);
        });
}


async function connect(token) {
    console.log(token);
    socket = io.connect(socketUrl, {
        autoConnect: false,
        transports: ["websocket"],
        auth: { token }
    });

    socket.on('connect',  () => {
        console.log('Connected');
    });
    socket.on('disconnect', (reason) => {
        console.log(`Disconnected: ${reason}`);
    });
    socket.on("connect_error", (err) => {
        console.log(err);
        const { message } = err;
        console.log(message);
        socket.close();
        window.location.href = "https://bidmoore-staging.web.app/";
    });

    socket.open();

    socket.on('bid', message => {
        console.log(message);
        updateLiveAuction(message.auction);
    })

    socket.on('auctions-update', message => {
        console.log('update:', message);
        updateAuctions(message);
    })

    socket.on('bid-fail', message => {
        // alert(message.message);
        console.log(message);
    })

    socket.on('subscription', message => {
        updateSubAuction(message.auction);
        console.log(message);
    })

    socket.on('sub-fail', message => {
        alert(message.message);
        console.log(message);
    })
    socket.on('sub-success', message => {
        document.getElementById('coin').innerText = commaSeperate(message.data.balance);
        console.log(message);
    })
    socket.on('error', err => {
        console.log('er', err);
    })

    socket.on('user-details', details => {
       username = details.username;
       document.getElementById('coin').innerText = commaSeperate(details.balance);
       fetchAuctions();
    })
};

setInterval(() => {
    const times = document.getElementsByClassName('time');
    for (let element of times) {
        let time = element.getAttribute("time");
        time -= 1000;
        element.setAttribute("time", time);
        element.textContent = parseTime(time);
    }
}, 1000);