package cryptoworldinvestement.com.feature.wallet

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.NorthEast
import androidx.compose.material.icons.filled.SouthWest
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import cryptoworldinvestement.com.core.designsystem.*
import cryptoworldinvestement.com.core.network.TransactionRecord
import cryptoworldinvestement.com.core.network.WalletSummary

@Composable
fun WalletScreen(
    summary: WalletSummary?,
    transactions: List<TransactionRecord>,
    onNavigateToDeposit: () -> Unit,
    onNavigateToWithdrawal: () -> Unit
) {
    LazyColumn(
        modifier = Modifier
            .fillMaxSize()
            .background(DarkBackground)
            .padding(16.dp),
        verticalArrangement = Arrangement.spacedBy(20.dp)
    ) {
        item {
            Text("USDT Wallet & Ledger", color = TextPrimary, fontSize = 20.sp, fontWeight = FontWeight.Bold)
        }

        item {
            Card(
                colors = CardDefaults.cardColors(containerColor = DarkSurface),
                shape = RoundedCornerShape(16.dp),
                modifier = Modifier.fillMaxWidth()
            ) {
                Column(modifier = Modifier.padding(20.dp)) {
                    Text("Total Balance", color = TextSecondary, fontSize = 13.sp)

                    val totalBal = summary?.totalBalance ?: 0.0
                    val availableBal = summary?.availableBalance ?: 0.0
                    val reservedBal = summary?.reservedBalance ?: 0.0

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
                            Text("Available", color = TextSecondary, fontSize = 11.sp)
                            Text("$${String.format("%.2f", availableBal)} USDT", color = TextPrimary, fontSize = 14.sp, fontWeight = FontWeight.SemiBold)
                        }
                        Column(horizontalAlignment = Alignment.End) {
                            Text("Reserved", color = TextSecondary, fontSize = 11.sp)
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
                            Text("Deposit", color = DarkBackground, fontWeight = FontWeight.Bold, fontSize = 14.sp)
                        }

                        Button(
                            onClick = onNavigateToWithdrawal,
                            colors = ButtonDefaults.buttonColors(containerColor = DarkSurfaceVariant),
                            shape = RoundedCornerShape(8.dp),
                            modifier = Modifier.weight(1f)
                        ) {
                            Icon(Icons.Default.NorthEast, contentDescription = null, tint = TextPrimary)
                            Spacer(modifier = Modifier.width(6.dp))
                            Text("Withdraw", color = TextPrimary, fontWeight = FontWeight.Bold, fontSize = 14.sp)
                        }
                    }
                }
            }
        }

        item {
            Text("Ledger History", color = TextPrimary, fontSize = 16.sp, fontWeight = FontWeight.Bold)
        }

        items(transactions) { tx ->
            Card(
                colors = CardDefaults.cardColors(containerColor = CardBackground),
                shape = RoundedCornerShape(8.dp),
                modifier = Modifier.fillMaxWidth()
            ) {
                Row(
                    modifier = Modifier.padding(14.dp),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Column {
                        Text(tx.type, color = TextPrimary, fontWeight = FontWeight.Bold, fontSize = 14.sp)
                        Text(tx.reference, color = TextSecondary, fontSize = 12.sp)
                    }

                    val isCredit = tx.amount >= 0
                    Text(
                        text = "${if (isCredit) "+" else ""}${String.format("%.2f", tx.amount)} USDT",
                        color = if (isCredit) PrimaryGreen else PrimaryRed,
                        fontSize = 15.sp,
                        fontWeight = FontWeight.Bold
                    )
                }
            }
        }
    }
}
