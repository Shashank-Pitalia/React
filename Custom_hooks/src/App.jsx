import { useState } from "react";
import "./App.css";
import InputBox from "./components/input";
import useCurrencyInfo from "./hooks/useCurrencyInfo";

function App() {
  const [amount, setAmount] = useState(0);
  const [from, setFrom] = useState("usd");
  const [to, setTo] = useState("inr");
  const [convertedAmount, setConvertedAmount] = useState(0);

  const currencyInfo = useCurrencyInfo(from);

  // Safe handling
  const options = currencyInfo ? Object.keys(currencyInfo) : [];

  // Swap currencies
  const swap = () => {
    setFrom(to);
    setTo(from);
    setConvertedAmount(amount);
    setAmount(convertedAmount);
  };

  // Convert logic
  const convert = () => {
    if (!currencyInfo) return;
    setConvertedAmount(amount * currencyInfo[to]);
  };

  return (
    <div
      className="w-full h-screen flex justify-center items-center bg-cover bg-no-repeat"
      style={{
        backgroundImage:
          "url('https://images.pexels.com/photos/36241800/pexels-photo-36241800.jpeg')",
      }}
    >
      <div className="w-full max-w-md mx-auto border border-gray-300 rounded-lg p-5 backdrop-blur-sm bg-white/30">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            convert();
          }}
        >
          {/* FROM */}
          <div className="w-full mb-2">
            <InputBox
              label="From"
              amount={amount}
              onAmountChange={(value) => setAmount(value)}
              onCurrencyChange={(currency) => setFrom(currency)}
              currencyOptions={options}
              selectedCurrency={from}
            />
          </div>

          {/* SWAP BUTTON */}
          <div className="relative w-full h-0.5 my-2">
            <button
              type="button"
              onClick={swap}
              className="absolute left-1/2 -translate-x-1/2 -translate-y-1/2 border border-white rounded-md bg-blue-600 text-white px-3 py-1 hover:bg-blue-700"
            >
              Swap
            </button>
          </div>

          {/* TO */}
          <div className="w-full mt-2 mb-4">
            <InputBox
              label="To"
              amount={convertedAmount}
              onCurrencyChange={(currency) => setTo(currency)}
              currencyOptions={options}
              selectedCurrency={to}
              amountDisabled
            />
          </div>

          {/* BUTTON */}
          <button
            type="submit"
            className="w-full bg-blue-600 text-white px-4 py-3 rounded-lg hover:bg-blue-700"
          >
            Convert {from.toUpperCase()} to {to.toUpperCase()}
          </button>
        </form>
      </div>
    </div>
  );
}

export default App;