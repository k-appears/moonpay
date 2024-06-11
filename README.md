# moonpay


Create a JSON API (REST) using Node.js and typescript which will return which cryptocurrency exchange we should use to buy a given amount of Bitcoin to minimize the amount of USD or USDT we'll spend on this trade.

Example API call (for 1 BTC):

curl http://localhost:4000/exchange-routing?amount=1

Example API response (if Binami price of $10,000 / BTC is the cheapest):

```json
{
  "amount": 1,
  "cost": 10000,
  "exchange": "coinbase"
}
```

Use [Binami Order Book API](https://github.com/binance/binance-spot-api-docs/blob/master/rest-api.md#order-book)

You'll need to compare Binance and Coinbase order books and compute the best execution price for the given amount of Bitcoin we want to buy. (You can assume that 1 USDT = 1 USD at all time.)

[Bonus] Add a third exchange to compare with Binance and Coinbase.
