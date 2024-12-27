import React, { useState, useEffect } from "react";
import {
  Typography,
  Radio,
  message,
  Card,
  Row,
  Col,
  Pagination,
  Tag,
  Button,
  Modal,
  Input,
} from "antd";
import { AptosClient } from "aptos";
import { useWallet } from "@aptos-labs/wallet-adapter-react";

const { Title } = Typography;
const { Meta } = Card;

const client = new AptosClient("https://fullnode.testnet.aptoslabs.com/v1");

type NFT = {
  id: number;
  owner: string;
  name: string;
  description: string;
  uri: string;
  price: number;
  for_sale: boolean;
  rarity: number;
  highest_bid: number;
  highest_bidder: string;
  auction_end_time?: number;
};

interface MarketViewProps {
  marketplaceAddr: string;
}

const rarityColors: { [key: number]: string } = {
  1: "green",
  2: "blue",
  3: "purple",
  4: "orange",
};

const rarityLabels: { [key: number]: string } = {
  1: "Common",
  2: "Uncommon",
  3: "Rare",
  4: "Super Rare",
};

const truncateAddress = (address: string, start = 6, end = 4) => {
  return `${address.slice(0, start)}...${address.slice(-end)}`;
};

const MarketView: React.FC<MarketViewProps> = ({ marketplaceAddr }) => {
  const { signAndSubmitTransaction, account } = useWallet();
  const [nfts, setNfts] = useState<NFT[]>([]);
  const [rarity, setRarity] = useState<"all" | number>("all");
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 8;

  const [isBuyModalVisible, setIsBuyModalVisible] = useState(false);
  const [selectedNft, setSelectedNft] = useState<NFT | null>(null);

  const [isBidModalVisible, setIsBidModalVisible] = useState(false);
  const [bidAmount, setBidAmount] = useState<string>("");

  // Add new state for view mode
  const [viewMode, setViewMode] = useState<'marketplace' | 'auctions'>('marketplace');

  useEffect(() => {
    handleFetchNfts(undefined);
  }, []);

  const handleFetchNfts = async (selectedRarity: number | undefined) => {
    try {
      const response = await client.getAccountResource(
        marketplaceAddr,
        "0xa9c2def31081a7eb7413fc4ec419bf1e92a0a40b7f24cc3c4750b4d67be8d7ca::NFTMarketplace::Marketplace"
      );
      const nftList = (response.data as { nfts: NFT[] }).nfts;

      const hexToUint8Array = (hexString: string): Uint8Array => {
        const bytes = new Uint8Array(hexString.length / 2);
        for (let i = 0; i < hexString.length; i += 2) {
          bytes[i / 2] = parseInt(hexString.substr(i, 2), 16);
        }
        return bytes;
      };

      const decodedNfts = nftList.map((nft) => ({
        ...nft,
        name: new TextDecoder().decode(hexToUint8Array(nft.name.slice(2))),
        description: new TextDecoder().decode(
          hexToUint8Array(nft.description.slice(2))
        ),
        uri: new TextDecoder().decode(hexToUint8Array(nft.uri.slice(2))),
        price: nft.price / 100000000,
      }));

      // Filter NFTs based on `for_sale` property and rarity if selected
      const filteredNfts = decodedNfts.filter(
        (nft) =>
          nft.for_sale &&
          (selectedRarity === undefined || nft.rarity === selectedRarity)
      );

      setNfts(filteredNfts);
      setCurrentPage(1);
    } catch (error) {
      console.error("Error fetching NFTs by rarity:", error);
      message.error("Failed to fetch NFTs.");
    }
  };

  // Add function to fetch auctioned NFTs
  const handleFetchAuctionedNfts = async () => {
    try {
      const response = await client.view({
        function: `${marketplaceAddr}::NFTMarketplace::get_all_auctioned_nfts`,
        type_arguments: [],
        arguments: [marketplaceAddr]
      });

      const auctionedNftIds = response[0] as number[];
      const auctionedNfts = await Promise.all(
        auctionedNftIds.map(async (id) => {
          // Get NFT details
          const nftDetails = await client.view({
            function: `${marketplaceAddr}::NFTMarketplace::get_nft_details`,
            arguments: [marketplaceAddr, id],
            type_arguments: [],
          });

          // Get auction details
          const auctionDetails = await client.view({
            function: `${marketplaceAddr}::NFTMarketplace::get_auction_details`,
            arguments: [marketplaceAddr, id.toString()],
            type_arguments: [],
          });

          const [nftId, owner, name, description, uri, price, forSale, rarity] = nftDetails as [
            number,
            string,
            string,
            string,
            string,
            number,
            boolean,
            number
          ];

          const [highestBid, highestBidder, endTime] = auctionDetails as [
            number,
            string,
            number
          ];

          const hexToUint8Array = (hexString: string): Uint8Array => {
            const bytes = new Uint8Array(hexString.length / 2);
            for (let i = 0; i < hexString.length; i += 2) {
              bytes[i / 2] = parseInt(hexString.substr(i, 2), 16);
            }
            return bytes;
          };

          return {
            id: nftId,
            owner,
            name: new TextDecoder().decode(hexToUint8Array(name.slice(2))),
            description: new TextDecoder().decode(hexToUint8Array(description.slice(2))),
            uri: new TextDecoder().decode(hexToUint8Array(uri.slice(2))),
            price: price / 100000000,
            for_sale: forSale,
            rarity,
            highest_bid: highestBid,
            highest_bidder: highestBidder,
            auction_end_time: endTime
          };
        })
      );

      setNfts(auctionedNfts);
    } catch (error) {
      console.error("Error fetching auctioned NFTs:", error);
      message.error("Failed to fetch auctioned NFTs.");
    }
  };

  // Add useEffect to handle view mode changes
  useEffect(() => {
    if (viewMode === 'marketplace') {
      handleFetchNfts(rarity === "all" ? undefined : rarity);
    } else {
      handleFetchAuctionedNfts();
    }
  }, [viewMode]);

  const handleBuyClick = (nft: NFT) => {
    setSelectedNft(nft);
    setIsBuyModalVisible(true);
  };

  const handleCancelBuy = () => {
    setIsBuyModalVisible(false);
    setSelectedNft(null);
  };

  const handleConfirmPurchase = async () => {
    if (!selectedNft) return;

    try {
      const priceInOctas = selectedNft.price * 100000000;

      const entryFunctionPayload = {
        type: "entry_function_payload",
        function: `${marketplaceAddr}::NFTMarketplace::purchase_nft`,
        type_arguments: [],
        arguments: [
          marketplaceAddr,
          selectedNft.id.toString(),
          priceInOctas.toString(),
        ],
      };

      const response = await (window as any).aptos.signAndSubmitTransaction(
        entryFunctionPayload
      );
      await client.waitForTransaction(response.hash);

      message.success("NFT purchased successfully!");
      setIsBuyModalVisible(false);
      handleFetchNfts(rarity === "all" ? undefined : rarity); // Refresh NFT list
      console.log("signAndSubmitTransaction:", signAndSubmitTransaction);
    } catch (error) {
      console.error("Error purchasing NFT:", error);
      message.error("Failed to purchase NFT.");
    }
  };

  const handleBidSubmit = async () => {
    if (!selectedNft || !bidAmount) return;

    try {
      const bidInOctas = parseFloat(bidAmount) * 100000000;

      const entryFunctionPayload = {
        type: "entry_function_payload",
        function: `${marketplaceAddr}::NFTMarketplace::bid`,
        type_arguments: [],
        arguments: [marketplaceAddr, selectedNft.id.toString(), bidInOctas.toString()],
      };

      const response = await (window as any).aptos.signAndSubmitTransaction(
        { payload: entryFunctionPayload }
      );
      await client.waitForTransaction(response.hash);

      message.success("Bid placed successfully!");
      setIsBidModalVisible(false);
      setBidAmount("");

      // Refresh the auctioned NFTs
      handleFetchAuctionedNfts();
    } catch (error) {
      console.error("Error placing bid:", error);
      message.error("Failed to place bid.");
    }
  };

  const handleClaimAuction = async (nftId: number) => {
    try {
      const entryFunctionPayload = {
        type: "entry_function_payload",
        function: `${marketplaceAddr}::NFTMarketplace::claim_auction_token`,
        type_arguments: [],
        arguments: [marketplaceAddr, nftId.toString()],
      };

      const response = await (window as any).aptos.signAndSubmitTransaction(
        {payload: entryFunctionPayload}
      );
      await client.waitForTransaction(response.hash);

      message.success("NFT claimed successfully!");
      handleFetchAuctionedNfts(); // Refresh the auction list
    } catch (error: any) {
      console.error("Error claiming NFT:", error);
      if (error.toString().includes("0x321")) {
        message.error("This NFT has already been claimed.");
      } else {
        message.error("Failed to claim NFT.");
      }
    }
  };

  // Add function to clear all auctioned NFTs
  const handleClearAuctionedNfts = async () => {
    try {
      const entryFunctionPayload = {
        type: "entry_function_payload",
        function: `${marketplaceAddr}::NFTMarketplace::clear_auctioned_nfts`,
        type_arguments: [],
        arguments: [marketplaceAddr],
      };

      const response = await (window as any).aptos.signAndSubmitTransaction(
        { payload: entryFunctionPayload }
      );
      await client.waitForTransaction(response.hash);

      message.success("All auctioned NFTs cleared successfully!");
      handleFetchAuctionedNfts(); // Refresh the auction list
    } catch (error) {
      console.error("Error clearing auctioned NFTs:", error);
      message.error("Failed to clear auctioned NFTs.");
    }
  };

  // Add function to cancel a particular auction
  const handleCancelAuction = async (nftId: number) => {
    try {
      const entryFunctionPayload = {
        type: "entry_function_payload",
        function: `${marketplaceAddr}::NFTMarketplace::cancel_auction`,
        type_arguments: [],
        arguments: [marketplaceAddr, nftId.toString()],
      };

      const response = await (window as any).aptos.signAndSubmitTransaction(entryFunctionPayload);
      await client.waitForTransaction(response.hash);

      message.success("Auction canceled successfully!");
      handleFetchAuctionedNfts(); // Refresh the auction list
    } catch (error) {
      console.error("Error canceling auction:", error);
      message.error("Failed to cancel auction.");
    }
  };

  const paginatedNfts = nfts.slice(
    (currentPage - 1) * pageSize,
    currentPage * pageSize
  );

  return (
    <div
      style={{
        textAlign: "center",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
      }}
    >
      <Title level={2} style={{ marginBottom: "20px" }}>
        {viewMode === 'marketplace' ? 'Marketplace' : 'Auctions'}
      </Title>

      {/* View Mode Toggle */}
      <Radio.Group 
        value={viewMode}
        onChange={(e) => setViewMode(e.target.value)}
        style={{ marginBottom: 20 }}
      >
        <Radio.Button value="marketplace">Marketplace</Radio.Button>
        <Radio.Button value="auctions">Auctions</Radio.Button>
      </Radio.Group>

      {/* Show rarity filter only in marketplace view */}
      {viewMode === 'marketplace' && (
        <div style={{ marginBottom: "20px" }}>
          <Radio.Group
            value={rarity}
            onChange={(e) => {
              const selectedRarity = e.target.value;
              setRarity(selectedRarity);
              handleFetchNfts(
                selectedRarity === "all" ? undefined : selectedRarity
              );
            }}
            buttonStyle="solid"
          >
            <Radio.Button value="all">All</Radio.Button>
            <Radio.Button value={1}>Common</Radio.Button>
            <Radio.Button value={2}>Uncommon</Radio.Button>
            <Radio.Button value={3}>Rare</Radio.Button>
            <Radio.Button value={4}>Super Rare</Radio.Button>
          </Radio.Group>
        </div>
      )}

      {/* Clear Auctioned NFTs Button */}
      {viewMode === 'auctions' && (
        <Button
          type="primary"
          onClick={handleClearAuctionedNfts}
          style={{ marginBottom: 20 }}
        >
          Clear All Auctioned NFTs
        </Button>
      )}

      {/* Card Grid */}
      <Row
        gutter={[24, 24]}
        style={{
          marginTop: 20,
          width: "100%",
          display: "flex",
          justifyContent: "center", // Center row content
          flexWrap: "wrap",
        }}
      >
        {paginatedNfts.map((nft) => (
          <Col
            key={nft.id}
            xs={24}
            sm={12}
            md={8}
            lg={6}
            xl={6}
            style={{
              display: "flex",
              justifyContent: "center", // Center the single card horizontally
              alignItems: "center", // Center content in both directions
            }}
          >
            <Card
              hoverable
              style={{
                width: "100%", // Make the card responsive
                maxWidth: "240px", // Limit the card width on larger screens
                margin: "0 auto",
              }}
              cover={<img alt={nft.name} src={nft.uri} />}
              actions={viewMode === 'marketplace' ? [
                <Button type="link" onClick={() => handleBuyClick(nft)}>
                  Buy
                </Button>
              ] : [
                <Button type="link" onClick={() => {
                  setSelectedNft(nft);
                  setIsBidModalVisible(true);
                }}>
                  Bid
                </Button>,
                nft.highest_bidder === account?.address && (
                  <Button type="link" onClick={() => handleClaimAuction(nft.id)}>
                    Claim
                  </Button>
                ),
                <Button type="link" onClick={() => handleCancelAuction(nft.id)}>
                  Cancel Auction
                </Button>
              ]}
            >
              {/* Rarity Tag */}
              <Tag
                color={rarityColors[nft.rarity]}
                style={{
                  fontSize: "14px",
                  fontWeight: "bold",
                  marginBottom: "10px",
                }}
              >
                {rarityLabels[nft.rarity]}
              </Tag>

              <Meta title={nft.name} description={`Price: ${nft.price} APT`} />
              <p>{nft.description}</p>
              <p>ID: {nft.id}</p>
              <p>Owner: {truncateAddress(nft.owner)}</p>
            </Card>
          </Col>
        ))}
      </Row>

      {/* Pagination */}
      <div style={{ marginTop: 30, marginBottom: 30 }}>
        <Pagination
          current={currentPage}
          pageSize={pageSize}
          total={nfts.length}
          onChange={(page) => setCurrentPage(page)}
          style={{ display: "flex", justifyContent: "center" }}
        />
      </div>

      {/* Buy Modal */}
      <Modal
        title="Purchase NFT"
        visible={isBuyModalVisible}
        onCancel={handleCancelBuy}
        footer={[
          <Button key="cancel" onClick={handleCancelBuy}>
            Cancel
          </Button>,
          <Button key="confirm" type="primary" onClick={handleConfirmPurchase}>
            Confirm Purchase
          </Button>,
        ]}
      >
        {selectedNft && (
          <>
            <p>
              <strong>NFT ID:</strong> {selectedNft.id}
            </p>
            <p>
              <strong>Name:</strong> {selectedNft.name}
            </p>
            <p>
              <strong>Description:</strong> {selectedNft.description}
            </p>
            <p>
              <strong>Rarity:</strong> {rarityLabels[selectedNft.rarity]}
            </p>
            <p>
              <strong>Price:</strong> {selectedNft.price} APT
            </p>
            <p>
              <strong>Owner:</strong> {truncateAddress(selectedNft.owner)}
            </p>
          </>
        )}
      </Modal>

      {/* Bid Modal */}
      <Modal
        title="Place Bid"
        visible={isBidModalVisible}
        onCancel={() => {
          setIsBidModalVisible(false);
          setBidAmount("");
        }}
        footer={[
          <Button key="cancel" onClick={() => {
            setIsBidModalVisible(false);
            setBidAmount("");
          }}>
            Cancel
          </Button>,
          <Button key="submit" type="primary" onClick={handleBidSubmit}>
            Place Bid
          </Button>,
        ]}
      >
        {selectedNft && (
          <>
            <p><strong>NFT ID:</strong> {selectedNft.id}</p>
            <p><strong>Name:</strong> {selectedNft.name}</p>
            <p><strong>Current Highest Bid:</strong> {selectedNft.highest_bid / 100000000} APT</p>
            <Input
              type="number"
              placeholder="Enter bid amount in APT"
              value={bidAmount}
              onChange={(e) => setBidAmount(e.target.value)}
              style={{ marginTop: 10 }}
            />
          </>
        )}
      </Modal>
    </div>
  );
};

export default MarketView;
