package cryptoworldinvestement.com.feature.rewards

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.ContentCopy
import androidx.compose.material.icons.filled.Share
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import cryptoworldinvestement.com.core.designsystem.*
import cryptoworldinvestement.com.core.network.RewardsSummary

@Composable
fun RewardsScreen(
    summary: RewardsSummary?
) {
    LazyColumn(
        modifier = Modifier
            .fillMaxSize()
            .background(DarkBackground)
            .padding(16.dp),
        verticalArrangement = Arrangement.spacedBy(20.dp)
    ) {
        item {
            Text("Referral Rewards Hub", color = TextPrimary, fontSize = 20.sp, fontWeight = FontWeight.Bold)
            Text("Earn $100 USDT for every direct referral + $10 for second-level referrals.", color = TextSecondary, fontSize = 13.sp)
        }

        item {
            Card(
                colors = CardDefaults.cardColors(containerColor = DarkSurface),
                shape = RoundedCornerShape(16.dp),
                modifier = Modifier.fillMaxWidth()
            ) {
                Column(
                    modifier = Modifier.padding(20.dp),
                    horizontalAlignment = Alignment.CenterHorizontally
                ) {
                    Text("Your Unique Referral Code", color = TextSecondary, fontSize = 12.sp)

                    val code = summary?.referralCode ?: "CHXXXXXX"
                    Surface(
                        color = DarkSurfaceVariant,
                        shape = RoundedCornerShape(8.dp),
                        modifier = Modifier.padding(vertical = 12.dp)
                    ) {
                        Text(
                            text = code,
                            color = AccentGold,
                            fontSize = 22.sp,
                            fontWeight = FontWeight.Bold,
                            modifier = Modifier.padding(horizontal = 24.dp, vertical = 10.dp)
                        )
                    }

                    Row(horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                        Button(
                            onClick = { },
                            colors = ButtonDefaults.buttonColors(containerColor = AccentGold),
                            shape = RoundedCornerShape(8.dp)
                        ) {
                            Icon(Icons.Default.ContentCopy, contentDescription = null, tint = DarkBackground)
                            Spacer(modifier = Modifier.width(6.dp))
                            Text("Copy Code", color = DarkBackground, fontWeight = FontWeight.Bold)
                        }

                        Button(
                            onClick = { },
                            colors = ButtonDefaults.buttonColors(containerColor = DarkSurfaceVariant),
                            shape = RoundedCornerShape(8.dp)
                        ) {
                            Icon(Icons.Default.Share, contentDescription = null, tint = TextPrimary)
                            Spacer(modifier = Modifier.width(6.dp))
                            Text("Share Link", color = TextPrimary, fontWeight = FontWeight.Bold)
                        }
                    }
                }
            }
        }

        item {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.spacedBy(12.dp)
            ) {
                Card(
                    colors = CardDefaults.cardColors(containerColor = CardBackground),
                    shape = RoundedCornerShape(12.dp),
                    modifier = Modifier.weight(1f)
                ) {
                    Column(modifier = Modifier.padding(16.dp)) {
                        Text("Level 1 ($100/ref)", color = TextSecondary, fontSize = 12.sp)
                        Text("${summary?.level1ReferralsCount ?: 0} Users", color = TextPrimary, fontSize = 18.sp, fontWeight = FontWeight.Bold)
                    }
                }

                Card(
                    colors = CardDefaults.cardColors(containerColor = CardBackground),
                    shape = RoundedCornerShape(12.dp),
                    modifier = Modifier.weight(1f)
                ) {
                    Column(modifier = Modifier.padding(16.dp)) {
                        Text("Level 2 ($10/ref)", color = TextSecondary, fontSize = 12.sp)
                        Text("${summary?.level2ReferralsCount ?: 0} Users", color = TextPrimary, fontSize = 18.sp, fontWeight = FontWeight.Bold)
                    }
                }
            }
        }

        item {
            Card(
                colors = CardDefaults.cardColors(containerColor = PrimaryGreen.copy(alpha = 0.12f)),
                shape = RoundedCornerShape(12.dp),
                modifier = Modifier.fillMaxWidth()
            ) {
                Row(
                    modifier = Modifier.padding(16.dp),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Column {
                        Text("Total Earned USDT", color = PrimaryGreen, fontSize = 13.sp, fontWeight = FontWeight.Bold)
                        Text("$${summary?.totalEarned ?: 0.0} USDT", color = TextPrimary, fontSize = 24.sp, fontWeight = FontWeight.Bold)
                    }
                    Text("Auto-Credited to Ledger", color = PrimaryGreen, fontSize = 11.sp, fontWeight = FontWeight.Bold)
                }
            }
        }

        item {
            Text("Reward Payout History", color = TextPrimary, fontSize = 16.sp, fontWeight = FontWeight.Bold)
        }

        val historyList = summary?.rewardHistory ?: emptyList()
        items(historyList) { item ->
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
                        Text(item.type, color = TextPrimary, fontWeight = FontWeight.Bold, fontSize = 14.sp)
                        Text(item.reference, color = TextSecondary, fontSize = 12.sp)
                    }

                    Text("+$${item.amount} USDT", color = PrimaryGreen, fontWeight = FontWeight.Bold, fontSize = 15.sp)
                }
            }
        }
    }
}
