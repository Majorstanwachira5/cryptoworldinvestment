package cryptoworldinvestement.com.feature.wallet

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import cryptoworldinvestement.com.core.designsystem.*

@Composable
fun WithdrawalScreen(
    availableBalance: Double,
    onRequestWithdrawal: (String, Double) -> Unit
) {
    var addressText by remember { mutableStateOf("") }
    var amountText by remember { mutableStateOf("") }
    var errorMessage by remember { mutableStateOf<String?>(null) }

    val amount = amountText.toDoubleOrNull() ?: 0.0
    val fee = 1.0 // 1 USDT network fee
    val netReceive = Math.max(0.0, amount - fee)

    Column(
        modifier = Modifier
            .fillMaxSize()
            .background(DarkBackground)
            .padding(16.dp)
    ) {
        Text("Withdraw USDT — TRC20", color = TextPrimary, fontSize = 20.sp, fontWeight = FontWeight.Bold)

        Spacer(modifier = Modifier.height(16.dp))

        Card(
            colors = CardDefaults.cardColors(containerColor = DarkSurface),
            shape = RoundedCornerShape(16.dp),
            modifier = Modifier.fillMaxWidth()
        ) {
            Column(modifier = Modifier.padding(20.dp)) {
                Text("Available Balance: $${String.format("%.2f", availableBalance)} USDT", color = AccentGold, fontSize = 13.sp, fontWeight = FontWeight.Bold)

                Spacer(modifier = Modifier.height(16.dp))

                OutlinedTextField(
                    value = addressText,
                    onValueChange = {
                        addressText = it
                        errorMessage = null
                    },
                    label = { Text("Destination TRC20 Address", color = TextSecondary) },
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

                OutlinedTextField(
                    value = amountText,
                    onValueChange = {
                        amountText = it
                        errorMessage = null
                    },
                    label = { Text("Withdrawal Amount (USDT)", color = TextSecondary) },
                    singleLine = true,
                    colors = OutlinedTextFieldDefaults.colors(
                        focusedBorderColor = AccentGold,
                        unfocusedBorderColor = DarkSurfaceVariant,
                        focusedTextColor = TextPrimary,
                        unfocusedTextColor = TextPrimary
                    ),
                    modifier = Modifier.fillMaxWidth()
                )

                if (errorMessage != null) {
                    Text(
                        text = errorMessage!!,
                        color = PrimaryRed,
                        fontSize = 12.sp,
                        modifier = Modifier.padding(top = 8.dp)
                    )
                }

                Spacer(modifier = Modifier.height(20.dp))

                Surface(
                    color = CardBackground,
                    shape = RoundedCornerShape(8.dp),
                    modifier = Modifier.fillMaxWidth()
                ) {
                    Column(modifier = Modifier.padding(12.dp)) {
                        Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                            Text("Network Fee", color = TextSecondary, fontSize = 12.sp)
                            Text("$1.00 USDT", color = TextPrimary, fontSize = 12.sp, fontWeight = FontWeight.Bold)
                        }
                        Spacer(modifier = Modifier.height(6.dp))
                        Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                            Text("Net Receive Amount", color = TextSecondary, fontSize = 12.sp)
                            Text("$${String.format("%.2f", netReceive)} USDT", color = PrimaryGreen, fontSize = 14.sp, fontWeight = FontWeight.Bold)
                        }
                    }
                }

                Spacer(modifier = Modifier.height(24.dp))

                Button(
                    onClick = {
                        if (addressText.isBlank()) {
                            errorMessage = "Please enter a valid TRC20 withdrawal address."
                            return@Button
                        }
                        if (amount < 10.0) {
                            errorMessage = "Minimum withdrawal amount is 10.00 USDT."
                            return@Button
                        }
                        if (amount > availableBalance) {
                            errorMessage = "Insufficient available USDT balance."
                            return@Button
                        }
                        onRequestWithdrawal(addressText, amount)
                    },
                    colors = ButtonDefaults.buttonColors(containerColor = AccentGold),
                    shape = RoundedCornerShape(8.dp),
                    modifier = Modifier
                        .fillMaxWidth()
                        .height(48.dp)
                ) {
                    Text("Confirm Withdrawal", color = DarkBackground, fontWeight = FontWeight.Bold, fontSize = 15.sp)
                }
            }
        }
    }
}
