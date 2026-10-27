package cryptoworldinvestement.com.feature.markets

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Search
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import cryptoworldinvestement.com.core.designsystem.*
import cryptoworldinvestement.com.core.network.MarketPair

@Composable
fun MarketsScreen(
    pairs: List<MarketPair>,
    onSelectPair: (String) -> Unit
) {
    var searchQuery by remember { mutableStateOf("") }

    val filteredPairs = remember(pairs, searchQuery) {
        if (searchQuery.isBlank()) pairs
        else pairs.filter { it.symbol.contains(searchQuery, ignoreCase = true) }
    }

    Column(
        modifier = Modifier
            .fillMaxSize()
            .background(DarkBackground)
            .padding(16.dp)
    ) {
        OutlinedTextField(
            value = searchQuery,
            onValueChange = { searchQuery = it },
            placeholder = { Text("Search trading pairs (e.g. BTC/USDT)...", color = TextSecondary) },
            leadingIcon = { Icon(Icons.Default.Search, contentDescription = null, tint = TextSecondary) },
            singleLine = true,
            colors = OutlinedTextFieldDefaults.colors(
                focusedBorderColor = AccentGold,
                unfocusedBorderColor = DarkSurfaceVariant,
                focusedTextColor = TextPrimary,
                unfocusedTextColor = TextPrimary
            ),
            modifier = Modifier
                .fillMaxWidth()
                .padding(bottom = 16.dp)
        )

        LazyColumn(
            verticalArrangement = Arrangement.spacedBy(8.dp)
        ) {
            items(filteredPairs) { pair ->
                Card(
                    colors = CardDefaults.cardColors(containerColor = DarkSurface),
                    shape = RoundedCornerShape(10.dp),
                    modifier = Modifier
                        .fillMaxWidth()
                        .clickable { onSelectPair(pair.symbol) }
                ) {
                    Row(
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(16.dp),
                        horizontalArrangement = Arrangement.SpaceBetween,
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Column {
                            Text(pair.symbol, color = TextPrimary, fontSize = 16.sp, fontWeight = FontWeight.Bold)
                            Text("Vol: $${String.format("%.1f", pair.volume24h / 1_000_000)}M", color = TextSecondary, fontSize = 12.sp)
                        }

                        Column(horizontalAlignment = Alignment.End) {
                            Text("$${pair.lastPrice}", color = TextPrimary, fontSize = 16.sp, fontWeight = FontWeight.Bold)

                            val isPositive = pair.change24h >= 0
                            Surface(
                                color = if (isPositive) PrimaryGreen.copy(alpha = 0.15f) else PrimaryRed.copy(alpha = 0.15f),
                                shape = RoundedCornerShape(4.dp),
                                modifier = Modifier.padding(top = 4.dp)
                            ) {
                                Text(
                                    text = "${if (isPositive) "+" else ""}${pair.change24h}%",
                                    color = if (isPositive) PrimaryGreen else PrimaryRed,
                                    fontSize = 12.sp,
                                    fontWeight = FontWeight.Bold,
                                    modifier = Modifier.padding(horizontal = 8.dp, vertical = 2.dp)
                                )
                            }
                        }
                    }
                }
            }
        }
    }
}
