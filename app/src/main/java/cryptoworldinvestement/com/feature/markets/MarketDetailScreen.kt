package cryptoworldinvestement.com.feature.markets

import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import cryptoworldinvestement.com.core.designsystem.*
import cryptoworldinvestement.com.core.network.Candlestick
import cryptoworldinvestement.com.core.network.MarketPair

@Composable
fun MarketDetailScreen(
    pair: MarketPair?,
    candles: List<Candlestick>,
    onNavigateToTrade: (String) -> Unit
) {
    if (pair == null) return

    Column(
        modifier = Modifier
            .fillMaxSize()
            .background(DarkBackground)
            .padding(16.dp)
    ) {
        // Pair Header
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically
        ) {
            Column {
                Text(pair.symbol, color = TextPrimary, fontSize = 24.sp, fontWeight = FontWeight.Bold)
                Text("Last Price: $${pair.lastPrice}", color = TextPrimary, fontSize = 18.sp, fontWeight = FontWeight.SemiBold)
            }

            val isPositive = pair.change24h >= 0
            Surface(
                color = if (isPositive) PrimaryGreen.copy(alpha = 0.15f) else PrimaryRed.copy(alpha = 0.15f),
                shape = RoundedCornerShape(6.dp)
            ) {
                Text(
                    text = "${if (isPositive) "+" else ""}${pair.change24h}%",
                    color = if (isPositive) PrimaryGreen else PrimaryRed,
                    fontSize = 14.sp,
                    fontWeight = FontWeight.Bold,
                    modifier = Modifier.padding(horizontal = 12.dp, vertical = 6.dp)
                )
            }
        }

        Spacer(modifier = Modifier.height(20.dp))

        // Interactive Candlestick Canvas
        Card(
            colors = CardDefaults.cardColors(containerColor = DarkSurface),
            shape = RoundedCornerShape(12.dp),
            modifier = Modifier
                .fillMaxWidth()
                .height(300.dp)
        ) {
            Column(modifier = Modifier.padding(16.dp)) {
                Text("Candlestick Chart (1H)", color = TextSecondary, fontSize = 12.sp, fontWeight = FontWeight.Bold)

                if (candles.isEmpty()) {
                    Box(modifier = Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                        CircularProgressIndicator(color = AccentGold)
                    }
                } else {
                    val minPrice = candles.minOf { it.low }
                    val maxPrice = candles.maxOf { it.high }
                    val priceRange = if (maxPrice > minPrice) maxPrice - minPrice else 1.0

                    Canvas(
                        modifier = Modifier
                            .fillMaxSize()
                            .padding(top = 12.dp)
                    ) {
                        val canvasWidth = size.width
                        val canvasHeight = size.height
                        val candleWidth = canvasWidth / candles.size

                        candles.forEachIndexed { index, candle ->
                            val x = index * candleWidth + (candleWidth / 2)

                            val openY = canvasHeight - ((candle.open - minPrice) / priceRange * canvasHeight).toFloat()
                            val closeY = canvasHeight - ((candle.close - minPrice) / priceRange * canvasHeight).toFloat()
                            val highY = canvasHeight - ((candle.high - minPrice) / priceRange * canvasHeight).toFloat()
                            val lowY = canvasHeight - ((candle.low - minPrice) / priceRange * canvasHeight).toFloat()

                            val isBullish = candle.close >= candle.open
                            val candleColor = if (isBullish) PrimaryGreen else PrimaryRed

                            // Draw wick
                            drawLine(
                                color = candleColor,
                                start = Offset(x, highY),
                                end = Offset(x, lowY),
                                strokeWidth = 2f
                            )

                            // Draw body
                            val topY = Math.min(openY, closeY)
                            val bodyHeight = Math.max(Math.abs(openY - closeY), 4f)

                            drawRect(
                                color = candleColor,
                                topLeft = Offset(x - candleWidth * 0.35f, topY),
                                size = Size(candleWidth * 0.7f, bodyHeight)
                            )
                        }
                    }
                }
            }
        }

        Spacer(modifier = Modifier.height(24.dp))

        Button(
            onClick = { onNavigateToTrade(pair.symbol) },
            colors = ButtonDefaults.buttonColors(containerColor = AccentGold),
            shape = RoundedCornerShape(8.dp),
            modifier = Modifier
                .fillMaxWidth()
                .height(50.dp)
        ) {
            Text("Trade ${pair.symbol} (Paper)", color = DarkBackground, fontWeight = FontWeight.Bold, fontSize = 16.sp)
        }
    }
}
