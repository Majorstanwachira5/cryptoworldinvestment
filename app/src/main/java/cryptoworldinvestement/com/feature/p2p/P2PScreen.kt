package cryptoworldinvestement.com.feature.p2p

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import cryptoworldinvestement.com.core.designsystem.*
import cryptoworldinvestement.com.core.network.P2PAd

@Composable
fun P2PScreen(
    ads: List<P2PAd>,
    onCreateOrder: (String, Double) -> Unit
) {
    var selectedTab by remember { mutableStateOf("BUY") }

    Column(
        modifier = Modifier
            .fillMaxSize()
            .background(DarkBackground)
            .padding(16.dp)
    ) {
        Text("P2P Marketplace", color = TextPrimary, fontSize = 20.sp, fontWeight = FontWeight.Bold)

        Spacer(modifier = Modifier.height(16.dp))

        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.spacedBy(12.dp)
        ) {
            Button(
                onClick = { selectedTab = "BUY" },
                colors = ButtonDefaults.buttonColors(
                    containerColor = if (selectedTab == "BUY") PrimaryGreen else DarkSurfaceVariant
                ),
                shape = RoundedCornerShape(8.dp),
                modifier = Modifier.weight(1f)
            ) {
                Text("Buy USDT", color = if (selectedTab == "BUY") DarkBackground else TextPrimary, fontWeight = FontWeight.Bold)
            }

            Button(
                onClick = { selectedTab = "SELL" },
                colors = ButtonDefaults.buttonColors(
                    containerColor = if (selectedTab == "SELL") PrimaryRed else DarkSurfaceVariant
                ),
                shape = RoundedCornerShape(8.dp),
                modifier = Modifier.weight(1f)
            ) {
                Text("Sell USDT", color = TextPrimary, fontWeight = FontWeight.Bold)
            }
        }

        Spacer(modifier = Modifier.height(16.dp))

        Surface(
            color = AccentGold.copy(alpha = 0.12f),
            shape = RoundedCornerShape(8.dp),
            modifier = Modifier
                .fillMaxWidth()
                .padding(bottom = 16.dp)
        ) {
            Text(
                text = "Escrow Protection: Seller balance reserved on server upon order creation.",
                color = AccentGold,
                fontSize = 12.sp,
                fontWeight = FontWeight.SemiBold,
                modifier = Modifier.padding(12.dp)
            )
        }

        LazyColumn(
            verticalArrangement = Arrangement.spacedBy(12.dp)
        ) {
            items(ads) { ad ->
                Card(
                    colors = CardDefaults.cardColors(containerColor = DarkSurface),
                    shape = RoundedCornerShape(12.dp),
                    modifier = Modifier.fillMaxWidth()
                ) {
                    Column(modifier = Modifier.padding(16.dp)) {
                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            horizontalArrangement = Arrangement.SpaceBetween,
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            Text(ad.merchantName, color = TextPrimary, fontSize = 16.sp, fontWeight = FontWeight.Bold)
                            Text("$${ad.price} ${ad.fiatCurrency}", color = PrimaryGreen, fontSize = 18.sp, fontWeight = FontWeight.Bold)
                        }

                        Spacer(modifier = Modifier.height(8.dp))

                        Text("Available: ${ad.availableAmount} USDT", color = TextSecondary, fontSize = 12.sp)
                        Text("Limit: $${ad.minLimit} - $${ad.maxLimit}", color = TextSecondary, fontSize = 12.sp)

                        Spacer(modifier = Modifier.height(12.dp))

                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            horizontalArrangement = Arrangement.SpaceBetween,
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            Text("Payment: ${ad.paymentMethods.joinToString(", ")}", color = AccentGold, fontSize = 11.sp, fontWeight = FontWeight.SemiBold)

                            Button(
                                onClick = { onCreateOrder(ad.adId, ad.minLimit) },
                                colors = ButtonDefaults.buttonColors(
                                    containerColor = if (ad.type == "SELL") PrimaryGreen else PrimaryRed
                                ),
                                shape = RoundedCornerShape(6.dp)
                            ) {
                                Text(
                                    text = if (ad.type == "SELL") "Buy USDT" else "Sell USDT",
                                    color = TextPrimary,
                                    fontWeight = FontWeight.Bold,
                                    fontSize = 12.sp
                                )
                            }
                        }
                    }
                }
            }
        }
    }
}
