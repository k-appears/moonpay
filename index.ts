import express, { Request, Response } from 'express';
import fetch from 'node-fetch';

const app = express();
const port = 4000;

const delay = (ms: number): Promise<void> => new Promise(resolve => setTimeout(resolve, ms));

const retryPromise = async <T>(fn: () => Promise<T>, retries: number = 3, delayTime: number = 1000): Promise<T> => {
  let attempt = 0;
  while (attempt < retries) {
    try {
      return await fn();
    } catch (error) {
      attempt++;
      if (attempt >= retries) {
        throw error;
      }
      await delay(delayTime * 2 ** (attempt - 1)); // Exponential backoff
    }
  }
  throw new Error('Retries exhausted');
};

interface OrderBook {
  bids: [string, string][];
  asks: [string, string][];
}

interface Exchange {
  name: string;
  fetchOrderBook: () => Promise<OrderBook>;
}

const binance: Exchange = {
  name: 'binance',
  fetchOrderBook: async () => {
    const response = await fetch('https://api.binance.com/api/v3/depth?symbol=BTCUSDT&limit=5000');
    return await response.json();
  },
};

const coinbase: Exchange = {
  name: 'coinbase',
  fetchOrderBook: async () => {
    const response = await fetch('https://api.pro.coinbase.com/products/BTC-USD/book?level=2');
    const data = await response.json();
    return {
      bids: data.bids.map(([price, size]: [string, string]) => [price, size]),
      asks: data.asks.map(([price, size]: [string, string]) => [price, size]),
    };
  },
};

const kraken: Exchange = {
  name: 'kraken',
  fetchOrderBook: async () => {
    const response = await fetch('https://api.kraken.com/0/public/Depth?pair=XBTUSD&count=5000');
    const data = await response.json();
    return {
      bids: Object.entries(data.result.XXBTZUSD.bids).map(([price, size]: [string, string]) => [price, size]),
      asks: Object.entries(data.result.XXBTZUSD.asks).map(([price, size]: [string, string]) => [price, size]),
    };
  },
};

const exchanges: Exchange[] = [binance, coinbase, kraken];

const getBestExecutionPrice = async (amount: number): Promise<{ exchange: string, cost: number; price: number;  }> => {
  const orderBooks: OrderBook[] = await Promise.all(
    exchanges.map((exchange) => retryPromise(exchange.fetchOrderBook))
  );
  const executionPrices: { exchange: string; cost: number; amount: number }[] = [];
  for (const orderBook of orderBooks) {
    let remainingAmount = amount;
    let totalPrice = 0;
    for (const [price, size] of orderBook.asks) {
      const sizeNumber = parseFloat(size);
      const priceNumber = parseFloat(price);
      if (remainingAmount > sizeNumber) {
        totalCost += sizeNumber * priceNumber;
        remainingAmount -= sizeNumber;
      } else {
        totalCost += remainingAmount * priceNumber;
        remainingAmount = 0;
        break;
      }
    }
    executionPrices.push({ exchange: exchanges[orderBooks.indexOf(orderBook)].name, cost: totalCost, amount: remainingAmount });
  }
/**
  const executionPrices = await Promise.all(exchanges.map(async (exchange) => {
    const orderBook = await exchange.fetchOrderBook();
    let remainingAmount = amount;
    let totalCost = 0;

    for (const [price, size] of orderBook.bids) {
      const sizeNumber = parseFloat(size);
      const priceNumber = parseFloat(price);

      if (remainingAmount > sizeNumber) {
        totalCost += sizeNumber * priceNumber;
        remainingAmount -= sizeNumber;
      } else {
        totalCost += remainingAmount * priceNumber;
        remainingAmount = 0;
        break;
      }
    }

    return { btcAmount: amount, usdAmount: totalCost, exchange: exchange.name };
  }));
*/
  return executionPrices.reduce((cheapest, current) => (current.cost < cheapest.cost ? current : cheapest));
};

app.get('/exchange-routing', async (req: Request, res: Response) => {
  const amount = parseFloat(req.query.amount as string);
  if (isNaN(amount) || amount <= 0) {
    res.status(400).json({ error: 'Invalid amount' });
    return;
  }

  const bestExecution = await getBestExecutionPrice(amount);
  res.json(bestExecution);
});

app.listen(port, () => {
  console.log(`Server is running on http://localhost:${port}`);
});
