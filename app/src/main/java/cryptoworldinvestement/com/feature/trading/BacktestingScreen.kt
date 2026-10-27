package cryptoworldinvestement.com.feature.trading

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import cryptoworldinvestement.com.core.designsystem.*
import cryptoworldinvestement.com.core.network.BacktestResponse

@Composable
fun BacktestingScreen(
    result: BacktestResponse?,
    onRunBacktest: (String, String, Double) -> Unit
) {
    var strategy by remember { mutableStateOf("SMA_CROSS") }
    var symbol by remember { mutableStateOf("BTC/USDT") }
    var capitalText by remember { mutableStateOf("10000") }

    LazyColumn(
        modifier = Modifier
            .fillMaxSize()
            .background(DarkBackground)
            .padding(16.dp),
        verticalArrangement = Arrangement.spacedBy(20.dp)
    ) {
        item {
            Text("Historical Strategy Backtester", color = TextPrimary, fontSize = 20.sp, fontWeight = FontWeight.Bold)
            Text("Simulate trading algorithms against historical candles without look-ahead bias.", color = TextSecondary, fontSize = 13.sp)
        }

        item {
            Card(
                colors = CardDefaults.cardColors(containerColor = DarkSurface),
                shape = RoundedCornerShape(12.dp),
                modifier = Modifier.fillMaxWidth()
            ) {
                Column(modifier = Modifier.padding(20.dp)) {
                    Text("Backtest Configuration", color = AccentGold, fontSize = 15.sp, fontWeight = FontWeight.Bold)

                    Spacer(modifier = Modifier.height(14.dp))

                    OutlinedTextField(
                        value = capitalText,
                        onValueChange = { capitalText = it },
                        label = { Text("Initial Simulated Capital (USDT)", color = TextSecondary) },
                        singleLine = true,
                        colors = OutlinedTextFieldDefaults.colors(
                            focusedBorderColor = AccentGold,
                            unfocusedBorderColor = DarkSurfaceVariant,
                            focusedTextColor = TextPrimary,
                            unfocusedTextColor = TextPrimary
                        ),
                        modifier = Modifier.fillMaxWidth()
                    )

                    Spacer(modifier = Modifier.height(16.dp))

                    Button(
                        onClick = {
                            val cap = capitalText.toDoubleOrNull() ?: 10000.0
                            onRunBacktest(strategy, symbol, cap)
                        },
                        colors = ButtonDefaults.buttonColors(containerColor = AccentGold),
                        shape = RoundedCornerShape(8.dp),
                        modifier = Modifier
                            .fillMaxWidth()
                            .height(48.dp)
                    ) {
                        Text("Run Strategy Backtest", color = DarkBackground, fontWeight = FontWeight.Bold, fontSize = 15.sp)
                    }
                }
            }
        }

        if (result != null) {
            item {
                Card(
                    colors = CardDefaults.cardColors(containerColor = CardBackground),
                    shape = RoundedCornerShape(12.dp),
                    modifier = Modifier.fillMaxWidth()
                ) {
                    Column(modifier = Modifier.padding(20.dp)) {
                        Text("Backtest Results Summary", color = TextPrimary, fontSize = 16.sp, fontWeight = FontWeight.Bold)

                        Spacer(modifier = Modifier.height(16.dp))

                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            horizontalArrangement = Arrangement.SpaceBetween
                        ) {
                            Column {
                                Text("Total Return", color = TextSecondary, fontSize = 12.sp)
                                val isPos = result.totalReturnPercent >= 0
                                Text(
                                    text = "${if (isPos) "+" else ""}${result.totalReturnPercent}%",
                                    color = if (isPos) PrimaryGreen else PrimaryRed,
                                    fontSize = 18.sp,
                                    fontWeight = FontWeight.Bold
                                )
                            }

                            Column(horizontalAlignment = Alignment.End) {
                                Text("Win Rate", color = TextSecondary, fontSize = 12.sp)
                                Text("${result.winRatePercent}%", color = TextPrimary, fontSize = 18.sp, fontWeight = FontWeight.Bold)
                            }
                        }

                        Spacer(modifier = Modifier.height(16.dp))

                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            horizontalArrangement = Arrangement.SpaceBetween
                        ) {
                            Column {
                                Text("Max Drawdown", color = TextSecondary, fontSize = 12.sp)
                                Text("-${result.maxDrawdownPercent}%", color = PrimaryRed, fontSize = 16.sp, fontWeight = FontWeight.Bold)
                            }

                            Column(horizontalAlignment = Alignment.End) {
                                Text("Profit Factor", color = TextSecondary, fontSize = 12.sp)
                                Text("${result.profitFactor}", color = AccentGold, fontSize = 16.sp, fontWeight = FontWeight.Bold)
                            }
                        }
                    }
                }
            }
        }
    }
}
