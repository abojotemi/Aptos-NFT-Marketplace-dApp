# NFT Marketplace on Aptos

This document provides an overview of the `transfer_nft` and `auction_nft` systems in the NFT Marketplace implemented in Move.

## Transfer NFT

### Overview
The `transfer_nft` function allows users to transfer ownership of an NFT to another user. This function ensures that only the current owner can initiate the transfer and prevents transferring to the same owner.

### Features
- **Ownership Verification**: Ensures that the caller is the current owner of the NFT.
- **Ownership Transfer**: Updates the owner of the NFT to the new recipient.
- **Reset Sale Status**: Resets the `for_sale` status and price of the NFT to prevent it from being listed for sale automatically after the transfer.

### How It Works
1. **Ownership Check**: The function checks if the caller is the current owner of the NFT.
2. **Recipient Check**: Ensures that the recipient is not the same as the current owner.
3. **Transfer Ownership**: Updates the owner of the NFT to the new recipient and resets its `for_sale` status and price.

### Example Usage
```move
public entry fun transfer_nft(account: &signer, marketplace_addr: address, nft_id: u64, recipient: address) acquires Marketplace {
    let marketplace = borrow_global_mut<Marketplace>(marketplace_addr);
    let nft_ref = vector::borrow_mut(&mut marketplace.nfts, nft_id);

    assert!(nft_ref.owner == signer::address_of(account), 500); // Caller is not the owner
    assert!(nft_ref.owner != recipient, 501); // Prevent transfer to the same owner

    // Transfer ownership
    nft_ref.owner = recipient;
    nft_ref.for_sale = false;
    nft_ref.price = 0;
}
```

## Auction NFT

### Overview
The auction system allows users to auction their NFTs. Users can initialize an auction, place bids, and claim the NFT or the highest bid amount after the auction ends.

### Features
- **Auction Initialization**: Allows the owner to start an auction for their NFT with a specified duration.
- **Bidding**: Users can place bids on the auctioned NFT. The highest bid is tracked.
- **Claiming**: The highest bidder can claim the NFT, and the owner can claim the highest bid amount after the auction ends.
- **Fee Deduction**: A marketplace fee is deducted from the highest bid amount before transferring the remaining amount to the owner.

### How It Works
1. **Initialize Auction**: The owner starts an auction by specifying the NFT ID and duration. The NFT must not be listed for sale.
2. **Place Bid**: Users place bids on the auctioned NFT. Each bid must be higher than the previous highest bid.
3. **Claim NFT**: The highest bidder claims the NFT after the auction ends.
4. **Claim Bid Amount**: The owner claims the highest bid amount after the auction ends, minus the marketplace fee.

### Example Usage
#### Initialize Auction
```move
public entry fun initialize_auction(
    account: &signer, 
    nft_id: u64, 
    duration: u64
) acquires Marketplace, AuctionData {
    let account_addr = signer::address_of(account);
    let marketplace = borrow_global_mut<Marketplace>(account_addr);
    let nft_ref = vector::borrow_mut(&mut marketplace.nfts, nft_id);

    // Basic checks
    assert!(nft_ref.owner == account_addr, 600); // Caller is not the owner
    assert!(!nft_ref.for_sale, 601); // NFT is already listed for sale
    
    // Duration validation
    assert!(duration >= 3600, 602); // Minimum 1 hour
    assert!(duration <= 604800, 603); // Maximum 1 week

    // Ensure AuctionData exists or create it
    if (!exists<AuctionData>(account_addr)) {
        move_to(account, AuctionData { items: vector::empty() });
    };

    let auction_data = borrow_global_mut<AuctionData>(account_addr);
    
    // Check NFT is not already in auction
    let items_len = vector::length(&auction_data.items);
    let i = 0;
    while (i < items_len) {
        let item = vector::borrow(&auction_data.items, i);
        assert!(item.nft_id != nft_id || item.claimed == true, 604);
        i = i + 1;
    };

    let auction_item = AuctionItem {
        nft_id,
        owner: account_addr,
        highest_bid: 0,
        highest_bidder: account_addr,
        started_at: timestamp::now_seconds(), // Current blockchain time
        duration,
        claimed: false
    };

    vector::push_back(&mut auction_data.items, auction_item);
}
```

#### Place Bid
```move
public entry fun bid(account: &signer, marketplace_addr: address, nft_id: u64, bid: u64) acquires AuctionData {
    let auction_data = borrow_global_mut<AuctionData>(marketplace_addr);
    let auction_item_ref = vector::borrow_mut(&mut auction_data.items, nft_id);

    assert!(bid > auction_item_ref.highest_bid, 700); // Bid is not higher than the current highest bid

    auction_item_ref.highest_bid = bid;
    auction_item_ref.highest_bidder = signer::address_of(account);
}
```

#### Claim Auction Token
```move
public entry fun claim_auction_token(account: &signer, marketplace_addr: address, nft_id: u64) acquires Marketplace, AuctionData {
    let auction_data = borrow_global_mut<AuctionData>(marketplace_addr);
    let auction_item_ref = vector::borrow_mut(&mut auction_data.items, nft_id);

    assert!(auction_item_ref.highest_bidder == signer::address_of(account), 800); // Caller is not the highest bidder
    assert!(auction_item_ref.claimed == false, 801); // Token already claimed

    let marketplace = borrow_global_mut<Marketplace>(marketplace_addr);
    let nft_ref = vector::borrow_mut(&mut marketplace.nfts, nft_id);

    nft_ref.owner = signer::address_of(account);
    nft_ref.for_sale = false;
    nft_ref.price = 0;

    auction_item_ref.claimed = true;
}
```

#### Claim Auction Coin
```move
public entry fun claim_auction_coin(account: &signer, marketplace_addr: address, nft_id: u64) acquires AuctionData {
    let auction_data = borrow_global_mut<AuctionData>(marketplace_addr);
    let auction_item_ref = vector::borrow_mut(&mut auction_data.items, nft_id);

    assert!(auction_item_ref.owner == signer::address_of(account), 900); // Caller is not the owner
    assert!(auction_item_ref.claimed == false, 901); // Coin already claimed

    let fee = (auction_item_ref.highest_bid * MARKETPLACE_FEE_PERCENT) / 100;
    let seller_revenue = auction_item_ref.highest_bid - fee;

    coin::transfer<aptos_coin::AptosCoin>(account, marketplace_addr, seller_revenue);
    coin::transfer<aptos_coin::AptosCoin>(account, signer::address_of(account), fee);

    auction_item_ref.claimed = true;
}
```

## Conclusion
The `transfer_nft` and `auction_nft` systems provide robust mechanisms for transferring and auctioning NFTs in the marketplace. These functions ensure secure and fair transactions, maintaining the integrity of the marketplace.
