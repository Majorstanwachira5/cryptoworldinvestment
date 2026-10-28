package cryptoworldinvestement.com.feature.home

import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import cryptoworldinvestement.com.R
import cryptoworldinvestement.com.core.designsystem.*
import cryptoworldinvestement.com.core.network.MarketPair
import cryptoworldinvestement.com.core.network.WalletSummary

@Composable
fun HomeScreen(
    walletSummary: WalletSummary?,
    marketPairs: List<MarketPair>,
    onNavigateToTrade: (String) -> Unit,
    onNavigateToDeposit: () -> Unit,
    onNavigateToRewards: () -> Unit
) {
    LazyColumn(
        modifier = Modifier
            .fillMaxSize()
            .background(DarkBackground)
            .padding(16.dp),
        verticalArrangement = Arrangement.spacedBy(20.dp)
    ) {
        // Top Brand Header Bar
        item {
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(vertical = 4.dp),
                verticalAlignment = Alignment.CenterVertically
            ) {
                Image(
                    painter = painterResource(id = R.drawable.ic_cwi_logo),
                    contentDescription = "CWI Logo",
                    modifier = Modifier.size(42.dp)
                )
                Spacer(modifier = Modifier.width(12.dp))
                Column {
                    Text(
                        text = "CryptoHub AI",
                        color = TextPrimary,
                        fontSize = 20.sp,
                        fontWeight = FontWeight.Bold
                    )
                    Text(
                        text = "CWI Professional Exchange",
                        color = AccentGold,
                        fontSize = 12.sp,
                        fontWeight = FontWeight.SemiBold
                    )
                }
            }
        }

        // Portfolio Card
        item {
            Card(
                colors = CardDefaults.cardColors(containerColor = DarkSurface),
                shape = RoundedCornerShape(16.dp),
                modifier = Modifier.fillMaxWidth()
            ) {
                Column(modifier = Modifier.padding(20.dp)) {
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.SpaceBetween,
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Text("Total Portfolio Value", color = TextSecondary, fontSize = 13.sp)
                        Row(verticalAlignment = Alignment.CenterVertically) {
                            Icon(Icons.Default.Shield, contentDescription = null, tint = PrimaryGreen, modifier = Modifier.size(16.dp))
                            Spacer(modifier = Modifier.width(4.dp))
                            Text("Ledger Verified", color = PrimaryGreen, fontSize = 11.sp, fontWeight = FontWeight.Bold)
                        }
                    }

                    val totalBal = walletSummary?.totalBalance ?: 0.0
                    val availableBal = walletSummary?.availableBalance ?: 0.0
                    val reservedBal = walletSummary?.reservedBalance ?: 0.0

                    Text(
                        text = "$${String.format("%.2f", totalBal)} USDT",
                        color = TextPrimary,
                        fontSize = 32.sp,
                        fontWeight = FontWeight.Bold,
                        modifier = Modifier.padding(vertical = 8.dp)
                    )

                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.SpaceBetween
                    ) {
                        Column {
                            Text("Available Balance", color = TextSecondary, fontSize = 11.sp)
                            Text("$${String.format("%.2f", availableBal)} USDT", color = TextPrimary, fontSize = 14.sp, fontWeight = FontWeight.SemiBold)
                        }
                        Column(horizontalAlignment = Alignment.End) {
                            Text("Reserved (Orders/P2P)", color = TextSecondary, fontSize = 11.sp)
                            Text("$${String.format("%.2f", reservedBal)} USDT", color = AccentGold, fontSize = 14.sp, fontWeight = FontWeight.SemiBold)
                        }
                    }

                    Spacer(modifier = Modifier.height(20.dp))

                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.spacedBy(12.dp)
                    ) {
                        Button(
                            onClick = onNavigateToDeposit,
                            colors = ButtonDefaults.buttonColors(containerColor = PrimaryGreen),
                            shape = RoundedCornerShape(8.dp),
                            modifier = Modifier.weight(1f)
                        ) {
                            Icon(Icons.Default.SouthWest, contentDescription = null, tint = DarkBackground)
                            Spacer(modifier = Modifier.width(6.dp))
                            Text("Deposit TRC20", color = DarkBackground, fontWeight = FontWeight.Bold, fontSize = 13.sp)
                        }

                        Button(
                            onClick = onNavigateToRewards,
                            colors = ButtonDefaults.buttonColors(containerColor = DarkSurfaceVariant),
                            shape = RoundedCornerShape(8.dp),
                            modifier = Modifier.weight(1f)
                        ) {
                            Icon(Icons.Default.CardGiftcard, contentDescription = null, tint = AccentGold)
                            Spacer(modifier = Modifier.width(6.dp))
                            Text("Earn $100", color = AccentGold, fontWeight = FontWeight.Bold, fontSize = 13.sp)
                        }
                    }
                }
            }
        }

        // Top Market Movers
        item {
            Column {
                Text("Top Market Movers", color = TextPrimary, fontSize = 18.sp, fontWeight = FontWeight.Bold)
                Spacer(modifier = Modifier.height(12.dp))

                LazyRow(
                    horizontalArrangement = Arrangement.spacedBy(12.dp)
                ) {
                    items(marketPairs.take(5)) { pair ->
                        Card(
                            colors = CardDefaults.cardColors(containerColor = DarkSurface),
                            shape = RoundedCornerShape(12.dp),
                            modifier = Modifier
                                .width(140.dp)
                                .clickable { onNavigateToTrade(pair.symbol) }
                        ) {
                            Column(modifier = Modifier.padding(14.dp)) {
                                Text(pair.symbol, color = TextPrimary, fontSize = 14.sp, fontWeight = FontWeight.Bold)
                                Spacer(modifier = Modifier.height(6.dp))
                                Text("$${pair.lastPrice}", color = TextPrimary, fontSize = 15.sp, fontWeight = FontWeight.SemiBold)
                                Spacer(modifier = Modifier.height(4.dp))

                                val isPositive = pair.change24h >= 0
                                Text(
                                    text = "${if (isPositive) "+" else ""}${pair.change24h}%",
                                    color = if (isPositive) PrimaryGreen else PrimaryRed,
                                    fontSize = 12.sp,
                                    fontWeight = FontWeight.Bold
                                )
                            }
                        }
                    }
                }
            }
        }

        // Quick Actions & Exchange Banners
        item {
            Card(
                colors = CardDefaults.cardColors(containerColor = CardBackground),
                shape = RoundedCornerShape(12.dp),
                modifier = Modifier
                    .fillMaxWidth()
                    .clickable { onNavigateToRewards() }
            ) {
                Row(
                    modifier = Modifier.padding(16.dp),
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Icon(Icons.Default.Celebration, contentDescription = null, tint = AccentGold, modifier = Modifier.size(36.dp))
                    Spacer(modifier = Modifier.width(16.dp))
                    Column(modifier = Modifier.weight(1f)) {
                        Text("2-Tier Referral Engine Active", color = TextPrimary, fontSize = 15.sp, fontWeight = FontWeight.Bold)
                        Text("Get $100 USDT for qualifying direct referrals & $10 for second-level.", color = TextSecondary, fontSize = 12.sp)
                    }
                    Icon(Icons.Default.ChevronRight, contentDescription = null, tint = TextSecondary)
                }
            }
        }
    }
}
