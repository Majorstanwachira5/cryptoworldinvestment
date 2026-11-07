"use client";

import React, { useEffect, useRef, useState } from "react";
import {
  createChart,
  IChartApi,
  ISeriesApi,
  UTCTimestamp,
  ColorType,
} from "lightweight-charts";
import { AlertTriangle } from "lucide-react";
import { Candle, MarketAsset } from "@/types";
import { calculateEMA } from "@/lib/indicators/technical";

interface TradingViewChartProps {
  asset: MarketAsset;
  candles: Candle[];
  stopLoss?: number;
  takeProfit?: number;
  entryPrice?: number;
  timeframe: string;
  onTimeframeChange: (tf: string) => void;
  /** Renders a notice that this instrument is not on a live feed. */
  dataNotice?: string | null;
}

export const TradingViewChart: React.FC<TradingViewChartProps> = ({
  asset,
  candles,
  stopLoss,
  takeProfit,
  entryPrice,
  timeframe,
  onTimeframeChange,
  dataNotice = null,
}) => {
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const candleSeriesRef = useRef<ISeriesApi<"Candlestick"> | null>(null);
  const volumeSeriesRef = useRef<ISeriesApi<"Histogram"> | null>(null);
  const ema50SeriesRef = useRef<ISeriesApi<"Line"> | null>(null);
  const ema200SeriesRef = useRef<ISeriesApi<"Line"> | null>(null);

  const [showEMA, setShowEMA] = useState(true);
  const [showVolume, setShowVolume] = useState(true);

  // Initialize and update chart
  useEffect(() => {
    if (!chartContainerRef.current) return;

    // Clean up previous instance
    if (chartRef.current) {
      chartRef.current.remove();
      chartRef.current = null;
    }

    const container = chartContainerRef.current;
    const isMobile = window.innerWidth < 640;
    const chartHeight = isMobile ? 330 : 480;

    const chart = createChart(container, {
      width: container.clientWidth,
      height: chartHeight,
      layout: {
        background: { type: ColorType.Solid, color: "#0d131f" },
        textColor: "#94a3b8",
        fontSize: 11,
      },
      grid: {
        vertLines: { color: "rgba(30, 41, 59, 0.45)" },
        horzLines: { color: "rgba(30, 41, 59, 0.45)" },
      },
      crosshair: {
        mode: 1,
        vertLine: { color: "#38bdf8", width: 1, style: 3 },
        horzLine: { color: "#38bdf8", width: 1, style: 3 },
      },
      timeScale: {
        borderColor: "#1e293b",
        timeVisible: true,
        secondsVisible: false,
      },
      rightPriceScale: {
        borderColor: "#1e293b",
        scaleMargins: {
          top: 0.1,
          bottom: 0.2,
        },
      },
    });

    chartRef.current = chart;

    // Candlestick Series
    //
    // The price scale is configured from the instrument's own precision. Without
    // this the library default is used, which suits a four-figure asset like
    // BTCUSDT and collapses a sub-1.00 pair such as EURUSD or DOGEUSDT into
    // repeated axis labels. This was the main reason some instruments looked
    // blank or wrong while Bitcoin looked correct.
    const candleSeries = chart.addCandlestickSeries({
      upColor: "#10b981",
      downColor: "#f43f5e",
      borderUpColor: "#10b981",
      borderDownColor: "#f43f5e",
      wickUpColor: "#10b981",
      wickDownColor: "#f43f5e",
      priceFormat: {
        type: "price",
        precision: asset.digits,
        minMove: Number(`1e-${asset.digits}`),
      },
    });
    candleSeriesRef.current = candleSeries;

    // Volume Series
    const volumeSeries = chart.addHistogramSeries({
      color: "#334155",
      priceFormat: { type: "volume" },
      priceScaleId: "", // overlay
    });
    volumeSeries.priceScale().applyOptions({
      scaleMargins: {
        top: 0.8,
        bottom: 0,
      },
    });
    volumeSeriesRef.current = volumeSeries;

    // EMA 50 Series (Cyan)
    const ema50Series = chart.addLineSeries({
      color: "#38bdf8",
      lineWidth: 1,
      title: "EMA 50",
      crosshairMarkerVisible: false,
    });
    ema50SeriesRef.current = ema50Series;

    // EMA 200 Series (Amber)
    const ema200Series = chart.addLineSeries({
      color: "#f59e0b",
      lineWidth: 2,
      title: "EMA 200",
      crosshairMarkerVisible: false,
    });
    ema200SeriesRef.current = ema200Series;

    // Resize handling.
    //
    // A ResizeObserver is used rather than only the window resize event because
    // the chart is hidden behind mobile tabs and inside a collapsing sidebar.
    // When it mounted at zero width the chart stayed blank: no window resize
    // fires on a tab switch, so nothing ever corrected the size.
    const handleResize = () => {
      if (chartContainerRef.current && chartRef.current) {
        const isMobile = window.innerWidth < 640;
        chartRef.current.applyOptions({
          width: chartContainerRef.current.clientWidth,
          height: isMobile ? 330 : 480,
        });
      }
    };

    const observer = new ResizeObserver(handleResize);
    observer.observe(container);
    window.addEventListener("resize", handleResize);
    // Apply once immediately: the container may have been measured before
    // layout settled.
    handleResize();

    return () => {
      observer.disconnect();
      window.removeEventListener("resize", handleResize);
      if (chartRef.current) {
        chartRef.current.remove();
        chartRef.current = null;
      }
    };
  }, []);

  // Price precision follows the instrument. Applying it as an option rather
  // than recreating the series preserves the user's zoom and pan.
  useEffect(() => {
    if (!candleSeriesRef.current) return;
    candleSeriesRef.current.applyOptions({
      priceFormat: {
        type: "price",
        precision: asset.digits,
        minMove: Number(`1e-${asset.digits}`),
      },
    });
  }, [asset.symbol, asset.digits]);

  // Update Data
  useEffect(() => {
    if (!candleSeriesRef.current || candles.length === 0) return;

    const formattedCandles = candles.map((c) => ({
      time: c.time as UTCTimestamp,
      open: c.open,
      high: c.high,
      low: c.low,
      close: c.close,
    }));

    candleSeriesRef.current.setData(formattedCandles);

    // Volume
    if (volumeSeriesRef.current) {
      const volumeData = candles.map((c) => ({
        time: c.time as UTCTimestamp,
        value: c.volume,
        color: c.close >= c.open ? "rgba(16, 185, 129, 0.25)" : "rgba(244, 63, 94, 0.25)",
      }));
      volumeSeriesRef.current.setData(showVolume ? volumeData : []);
    }

    // EMAs
    const closePrices = candles.map((c) => c.close);
    const ema50Values = calculateEMA(closePrices, 50);
    const ema200Values = calculateEMA(closePrices, 200);

    if (ema50SeriesRef.current) {
      const offset50 = Math.max(0, candles.length - ema50Values.length);
      const ema50Data = ema50Values.map((val, idx) => ({
        time: candles[idx + offset50].time as UTCTimestamp,
        value: val,
      }));
      ema50SeriesRef.current.setData(showEMA ? ema50Data : []);
    }

    if (ema200SeriesRef.current) {
      const offset200 = Math.max(0, candles.length - ema200Values.length);
      const ema200Data = ema200Values.map((val, idx) => ({
        time: candles[idx + offset200].time as UTCTimestamp,
        value: val,
      }));
      ema200SeriesRef.current.setData(showEMA ? ema200Data : []);
    }

    // Fit content only when the instrument or timeframe changes. Doing it on
    // every data refresh reset the user's zoom and pan roughly once a second,
    // because candles arrive on a live tick.
  }, [candles, showEMA, showVolume]);

  // Fit the visible range when the series being displayed changes, so the new
  // instrument is shown in full without disturbing zoom on ordinary ticks.
  const lastSeriesKey = useRef<string>("");
  useEffect(() => {
    const key = `${asset.symbol}:${timeframe}`;
    if (lastSeriesKey.current === key) return;
    lastSeriesKey.current = key;
    if (candles.length > 0) {
      chartRef.current?.timeScale().fitContent();
    }
  }, [asset.symbol, timeframe, candles.length]);

  // Apply SL / TP price lines on chart
  useEffect(() => {
    if (!candleSeriesRef.current) return;

    // Add SL line if set
    let slLine: unknown = null;
    let tpLine: unknown = null;

    if (stopLoss && stopLoss > 0) {
      slLine = candleSeriesRef.current.createPriceLine({
        price: stopLoss,
        color: "#f43f5e",
        lineWidth: 1,
        lineStyle: 2,
        axisLabelVisible: true,
        title: "STOP LOSS",
      });
    }

    if (takeProfit && takeProfit > 0) {
      tpLine = candleSeriesRef.current.createPriceLine({
        price: takeProfit,
        color: "#10b981",
        lineWidth: 1,
        lineStyle: 2,
        axisLabelVisible: true,
        title: "TAKE PROFIT",
      });
    }

    return () => {
      if (slLine && candleSeriesRef.current) {
        candleSeriesRef.current.removePriceLine(slLine as any);
      }
      if (tpLine && candleSeriesRef.current) {
        candleSeriesRef.current.removePriceLine(tpLine as any);
      }
    };
  }, [stopLoss, takeProfit]);

  return (
    <div className="flex flex-col bg-[#0d131f] border border-slate-800 rounded-xl overflow-hidden">
      {/* Chart Control Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 bg-[#111726] border-b border-slate-800 text-xs">
        {/* Timeframe Buttons */}
        <div className="flex items-center gap-1">
          {["1m", "5m", "15m", "1H", "4H", "1D"].map((tf) => (
            <button
              key={tf}
              onClick={() => onTimeframeChange(tf)}
              className={`px-2.5 py-1 rounded text-[11px] font-bold transition-all ${
                timeframe === tf
                  ? "bg-cyan-500 text-slate-950"
                  : "text-slate-400 hover:text-white hover:bg-slate-800"
              }`}
            >
              {tf}
            </button>
          ))}
        </div>

        <span className="text-[10px] font-bold text-slate-500 tracking-wide uppercase hidden sm:inline">
          {asset.symbol}
        </span>

        {/* Indicators and Layers Toggles */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowEMA(!showEMA)}
            className={`flex items-center gap-1 px-2.5 py-1 rounded text-[11px] font-medium border transition-all ${
              showEMA
                ? "bg-cyan-950/60 border-cyan-800 text-cyan-400"
                : "bg-slate-900 border-slate-800 text-slate-500"
            }`}
          >
            <span className="h-1.5 w-1.5 rounded-full bg-cyan-400" />
            EMA 50/200
          </button>

          <button
            onClick={() => setShowVolume(!showVolume)}
            className={`flex items-center gap-1 px-2.5 py-1 rounded text-[11px] font-medium border transition-all ${
              showVolume
                ? "bg-slate-800 border-slate-700 text-slate-200"
                : "bg-slate-900 border-slate-800 text-slate-500"
            }`}
          >
            Vol
          </button>
        </div>
      </div>

      {/* Chart Canvas */}
      <div className="relative w-full h-[480px]">
        <div ref={chartContainerRef} className="w-full h-full" />

        {/* Stated plainly rather than letting a stale series pass for a live
            market. Forex without a configured intraday feed is on a daily
            reference rate, and the user should know that. */}
        {dataNotice && (
          <div className="absolute top-2 left-2 right-2 z-10 flex items-center gap-1.5 rounded-lg bg-amber-950/85 border border-amber-700/60 px-2.5 py-1.5 text-[10px] font-bold text-amber-300">
            <AlertTriangle className="w-3 h-3 shrink-0" />
            <span>{dataNotice}</span>
          </div>
        )}
      </div>
    </div>
  );
};
