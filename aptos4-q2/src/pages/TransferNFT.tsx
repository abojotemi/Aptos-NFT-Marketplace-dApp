import React, { useState } from "react";
import { Form, Input, Button, message } from "antd";
import { AptosClient } from "aptos";
import { useWallet } from "@aptos-labs/wallet-adapter-react";

const client = new AptosClient("https://fullnode.testnet.aptoslabs.com/v1");
const marketplaceAddr =
  "0xa9c2def31081a7eb7413fc4ec419bf1e92a0a40b7f24cc3c4750b4d67be8d7ca";

const TransferNFT: React.FC = () => {
  const [loading, setLoading] = useState(false);

  const handleTransferNFT = async (values: {
    nftId: string;
    recipient: string;
  }) => {
    setLoading(true);
    try {
      const entryFunctionPayload = {
        type: "entry_function_payload",
        function: `${marketplaceAddr}::NFTMarketplace::transfer_nft`,
        type_arguments: [],
        arguments: [marketplaceAddr, values.nftId, values.recipient],
      };

      const txnResponse = await (window as any).aptos.signAndSubmitTransaction(
        entryFunctionPayload
      );
      await client.waitForTransaction(txnResponse.hash);

      message.success("NFT transferred successfully!");
    } catch (error) {
      console.error("Error transferring NFT:", error);
      message.error("Failed to transfer NFT.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ maxWidth: 600, margin: "0 auto", padding: "20px" }}>
      <h2>Transfer NFT</h2>
      <Form layout="vertical" onFinish={handleTransferNFT}>
        <Form.Item
          label="NFT ID"
          name="nftId"
          rules={[{ required: true, message: "Please enter the NFT ID!" }]}
        >
          <Input />
        </Form.Item>
        <Form.Item
          label="Recipient Address"
          name="recipient"
          rules={[
            { required: true, message: "Please enter the recipient address!" },
          ]}
        >
          <Input />
        </Form.Item>
        <Form.Item>
          <Button type="primary" htmlType="submit" loading={loading}>
            Transfer NFT
          </Button>
        </Form.Item>
      </Form>
    </div>
  );
};

export default TransferNFT;
