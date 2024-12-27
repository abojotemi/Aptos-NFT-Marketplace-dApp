// TODO# 1: Define Module and Marketplace Address
address NFTMarketplace {

    module NFTMarketplace {
        use 0x1::signer;
        use 0x1::vector;
        use 0x1::coin;
        use 0x1::aptos_coin;
        use aptos_framework::timestamp;

        // TODO# 2: Define NFT Structure
        struct NFT has store, key {
            id: u64,
            owner: address,
            name: vector<u8>,
            description: vector<u8>,
            uri: vector<u8>,
            price: u64,
            for_sale: bool,
            rarity: u8  // 1 for common, 2 for rare, 3 for epic, etc.
        }

        // TODO# 3: Define Marketplace Structure
        struct Marketplace has key {
            nfts: vector<NFT>
        }
        
        // TODO# 4: Define ListedNFT Structure
        struct ListedNFT has copy, drop {
            id: u64,
            price: u64,
            rarity: u8
        }

        // Define AuctionItem structure
        struct AuctionItem has store, key {
            nft_id: u64,
            owner: address,
            highest_bid: u64,
            highest_bidder: address,
            started_at: u64,
            duration: u64,
            claimed: bool
        }

        // Define AuctionData structure
        struct AuctionData has key {
            items: vector<AuctionItem>
        }

        // TODO# 5: Set Marketplace Fee
        const MARKETPLACE_FEE_PERCENT: u64 = 2; // 2% fee

        // TODO# 6: Initialize Marketplace        
        public entry fun initialize(account: &signer) {
            let marketplace = Marketplace {
                nfts: vector::empty<NFT>()
            };
            move_to(account, marketplace);
        }

        // TODO# 7: Check Marketplace Initialization
        #[view]
        public fun is_marketplace_initialized(marketplace_addr: address): bool {
            exists<Marketplace>(marketplace_addr)
        }

        // TODO# 8: Mint New NFT
        public entry fun mint_nft(account: &signer, name: vector<u8>, description: vector<u8>, uri: vector<u8>, rarity: u8) acquires Marketplace {
            let marketplace_addr = signer::address_of(account);
            if (!exists<Marketplace>(marketplace_addr)) {
                let marketplace = Marketplace {
                    nfts: vector::empty<NFT>()
                };
                move_to(account, marketplace);
            };
            let marketplace = borrow_global_mut<Marketplace>(marketplace_addr);
            let nft_id = vector::length(&marketplace.nfts);

            let new_nft = NFT {
                id: nft_id,
                owner: signer::address_of(account),
                name,
                description,
                uri,
                price: 0,
                for_sale: false,
                rarity
            };

            vector::push_back(&mut marketplace.nfts, new_nft);
        }
        
        // TODO# 9: View NFT Details
        #[view]
        public fun get_nft_details(marketplace_addr: address, nft_id: u64): (u64, address, vector<u8>, vector<u8>, vector<u8>, u64, bool, u8) acquires Marketplace {
            let marketplace = borrow_global<Marketplace>(marketplace_addr);
            let nft = vector::borrow(&marketplace.nfts, nft_id);

            (nft.id, nft.owner, nft.name, nft.description, nft.uri, nft.price, nft.for_sale, nft.rarity)
        }
        
        // TODO# 10: List NFT for Sale
        public entry fun list_for_sale(account: &signer, marketplace_addr: address, nft_id: u64, price: u64) acquires Marketplace {
            let marketplace = borrow_global_mut<Marketplace>(marketplace_addr);
            let nft_ref = vector::borrow_mut(&mut marketplace.nfts, nft_id);

            assert!(nft_ref.owner == signer::address_of(account), 100); // Caller is not the owner
            assert!(!nft_ref.for_sale, 101); // NFT is already listed
            assert!(price > 0, 102); // Invalid price

            nft_ref.for_sale = true;
            nft_ref.price = price;
        }

        // TODO# 11: Update NFT Price
        public entry fun set_price(account: &signer, marketplace_addr: address, nft_id: u64, price: u64) acquires Marketplace {
            let marketplace = borrow_global_mut<Marketplace>(marketplace_addr);
            let nft_ref = vector::borrow_mut(&mut marketplace.nfts, nft_id);

            assert!(nft_ref.owner == signer::address_of(account), 200); // Caller is not the owner
            assert!(price > 0, 201); // Invalid price

            nft_ref.price = price;
        }

        // TODO# 12: Purchase NFT
        public entry fun purchase_nft(account: &signer, marketplace_addr: address, nft_id: u64, payment: u64) acquires Marketplace {
            let marketplace = borrow_global_mut<Marketplace>(marketplace_addr);
            let nft_ref = vector::borrow_mut(&mut marketplace.nfts, nft_id);

            assert!(nft_ref.for_sale, 400); // NFT is not for sale
            assert!(payment >= nft_ref.price, 401); // Insufficient payment

            // Calculate marketplace fee
            let fee = (nft_ref.price * MARKETPLACE_FEE_PERCENT) / 100;
            let seller_revenue = payment - fee;

            // Transfer payment to the seller and fee to the marketplace
            coin::transfer<aptos_coin::AptosCoin>(account, marketplace_addr, seller_revenue);
            coin::transfer<aptos_coin::AptosCoin>(account, signer::address_of(account), fee);

            // Transfer ownership
            nft_ref.owner = signer::address_of(account);
            nft_ref.for_sale = false;
            nft_ref.price = 0;
        }

        // TODO# 13: Check if NFT is for Sale
        #[view]
        public fun is_nft_for_sale(marketplace_addr: address, nft_id: u64): bool acquires Marketplace {
            let marketplace = borrow_global<Marketplace>(marketplace_addr);
            let nft = vector::borrow(&marketplace.nfts, nft_id);
            nft.for_sale
        }

        // TODO# 14: Get NFT Price
        #[view]
        public fun get_nft_price(marketplace_addr: address, nft_id: u64): u64 acquires Marketplace {
            let marketplace = borrow_global<Marketplace>(marketplace_addr);
            let nft = vector::borrow(&marketplace.nfts, nft_id);
            nft.price
        }

        // TODO# 15: Transfer Ownership
        public entry fun transfer_ownership(account: &signer, marketplace_addr: address, nft_id: u64, new_owner: address) acquires Marketplace {
            let marketplace = borrow_global_mut<Marketplace>(marketplace_addr);
            let nft_ref = vector::borrow_mut(&mut marketplace.nfts, nft_id);

            assert!(nft_ref.owner == signer::address_of(account), 300); // Caller is not the owner
            assert!(nft_ref.owner != new_owner, 301); // Prevent transfer to the same owner

            // Update NFT ownership and reset its for_sale status and price
            nft_ref.owner = new_owner;
            nft_ref.for_sale = false;
            nft_ref.price = 0;
        }

        // TODO# 16: Retrieve NFT Owner
        #[view]
        public fun get_owner(marketplace_addr: address, nft_id: u64): address acquires Marketplace {
            let marketplace = borrow_global<Marketplace>(marketplace_addr);
            let nft = vector::borrow(&marketplace.nfts, nft_id);
            nft.owner
        }

        // TODO# 17: Retrieve NFTs for Sale
         #[view]
        public fun get_all_nfts_for_owner(marketplace_addr: address, owner_addr: address, limit: u64, offset: u64): vector<u64> acquires Marketplace {
            let marketplace = borrow_global<Marketplace>(marketplace_addr);
            let nft_ids = vector::empty<u64>();

            let nfts_len = vector::length(&marketplace.nfts);
            let end = min(offset + limit, nfts_len);
            let mut_i = offset;
            while (mut_i < end) {
                let nft = vector::borrow(&marketplace.nfts, mut_i);
                if (nft.owner == owner_addr) {
                    vector::push_back(&mut nft_ids, nft.id);
                };
                mut_i = mut_i + 1;
            };

            nft_ids
        }

        // TODO# 18: Retrieve NFTs for Sale
        #[view]
        public fun get_all_nfts_for_sale(marketplace_addr: address, limit: u64, offset: u64): vector<ListedNFT> acquires Marketplace {
            let marketplace = borrow_global<Marketplace>(marketplace_addr);
            let nfts_for_sale = vector::empty<ListedNFT>();

            let nfts_len = vector::length(&marketplace.nfts);
            let end = min(offset + limit, nfts_len);
            let mut_i = offset;
            while (mut_i < end) {
                let nft = vector::borrow(&marketplace.nfts, mut_i);
                if (nft.for_sale) {
                    let listed_nft = ListedNFT { id: nft.id, price: nft.price, rarity: nft.rarity };
                    vector::push_back(&mut nfts_for_sale, listed_nft);
                };
                mut_i = mut_i + 1;
            };

            nfts_for_sale
        }

        // TODO# 19: Define Helper Function for Minimum Value
        // Helper function to find the minimum of two u64 numbers
        public fun min(a: u64, b: u64): u64 {
            if (a < b) { a } else { b }
        }

        // TODO# 20: Retrieve NFTs by Rarity
        // New function to retrieve NFTs by rarity
        #[view]
        public fun get_nfts_by_rarity(marketplace_addr: address, rarity: u8): vector<u64> acquires Marketplace {
            let marketplace = borrow_global<Marketplace>(marketplace_addr);
            let nft_ids = vector::empty<u64>();

            let nfts_len = vector::length(&marketplace.nfts);
            let mut_i = 0;
            while (mut_i < nfts_len) {
                let nft = vector::borrow(&marketplace.nfts, mut_i);
                if (nft.rarity == rarity) {
                    vector::push_back(&mut nft_ids, nft.id);
                };
                mut_i = mut_i + 1;
            };

            nft_ids
        }
        // TODO# 21: Transfer NFT to Another User
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

        // Initialize Auction
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

        // Bid on Auction
        public entry fun bid(account: &signer, marketplace_addr: address, nft_id: u64, bid: u64) acquires AuctionData {
            let auction_data = borrow_global_mut<AuctionData>(marketplace_addr);
            let items_len = vector::length(&auction_data.items);
            let i = 0;
            let found = false;

            while (i < items_len) {
                let auction_item_ref = vector::borrow_mut(&mut auction_data.items, i);
                if (auction_item_ref.nft_id == nft_id) {
                    assert!(bid > auction_item_ref.highest_bid, 700); // Bid is not higher than the current highest bid

                    auction_item_ref.highest_bid = bid;
                    auction_item_ref.highest_bidder = signer::address_of(account);
                    found = true;
                    break;
                };
                i = i + 1;
            };

            assert!(found, 701); // Auction not found for the given NFT ID
        }

        // Claim Auction Token
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

        // Claim Auction Coin
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

        // Get All Auctioned NFTs
        #[view]
        public fun get_all_auctioned_nfts(marketplace_addr: address): vector<u64> acquires AuctionData {
            if (!exists<AuctionData>(marketplace_addr)) {
                return vector::empty()
            };
            
            let auction_data = borrow_global<AuctionData>(marketplace_addr);
            let auctioned_nfts = vector::empty<u64>();
            let items_len = vector::length(&auction_data.items);
            let i = 0;
            
            while (i < items_len) {
                let item = vector::borrow(&auction_data.items, i);
                if (!item.claimed) {
                    vector::push_back(&mut auctioned_nfts, item.nft_id);
                };
                i = i + 1;
            };
            
            auctioned_nfts
        }

        // Get Auction Details
        #[view]
        public fun get_auction_details(marketplace_addr: address, nft_id: u64): (u64, address, u64) acquires AuctionData {
            let auction_data = borrow_global<AuctionData>(marketplace_addr);
            let items_len = vector::length(&auction_data.items);
            let i = 0;
            while (i < items_len) {
                let item = vector::borrow(&auction_data.items, i);
                if (item.nft_id == nft_id) {
                    return (item.highest_bid, item.highest_bidder, item.started_at + item.duration);
                };
                i = i + 1;
            };
            // If no auction found, return default values
            (0, @0x0, 0)
        }

        // Clear all auctioned NFTs
        public entry fun clear_auctioned_nfts(account: &signer, marketplace_addr: address) acquires AuctionData {
            let auction_data = borrow_global_mut<AuctionData>(marketplace_addr);
            let items_len = vector::length(&auction_data.items);
            let i = 0;
            while (i < items_len) {
                let item_ref = vector::borrow_mut(&mut auction_data.items, i);
                item_ref.claimed = true;
                i = i + 1;
            };
        }

        // Cancel a particular auction for an NFT
        public entry fun cancel_auction(account: &signer, marketplace_addr: address, nft_id: u64) acquires AuctionData {
            let auction_data = borrow_global_mut<AuctionData>(marketplace_addr);
            let items_len = vector::length(&auction_data.items);
            let i = 0;
            let found = false;
            while (i < items_len) {
                let item_ref = vector::borrow_mut(&mut auction_data.items, i);
                if (item_ref.nft_id == nft_id) {
                    assert!(item_ref.owner == signer::address_of(account), 100); // Caller is not the owner
                    item_ref.claimed = true;
                    found = true;
                    break;
                };
                i = i + 1;
            };
            assert!(found, 101); // Auction not found
        }

    }
}