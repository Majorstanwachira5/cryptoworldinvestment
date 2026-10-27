package cryptoworldinvestement.com.core.database

import android.content.Context
import androidx.room.Dao
import androidx.room.Database
import androidx.room.Entity
import androidx.room.Insert
import androidx.room.OnConflictStrategy
import androidx.room.PrimaryKey
import androidx.room.Query
import androidx.room.Room
import androidx.room.RoomDatabase

@Entity(tableName = "cached_market_pairs")
data class CachedMarketPairEntity(
    @PrimaryKey val symbol: String,
    val baseAsset: String,
    val quoteAsset: String,
    val lastPrice: Double,
    val change24h: Double,
    val high24h: Double,
    val low24h: Double,
    val volume24h: Double
)

@Dao
interface MarketPairDao {
    @Query("SELECT * FROM cached_market_pairs")
    suspend fun getAllPairs(): List<CachedMarketPairEntity>

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertAll(pairs: List<CachedMarketPairEntity>)

    @Query("DELETE FROM cached_market_pairs")
    suspend fun clearAll()
}

@Database(entities = [CachedMarketPairEntity::class], version = 1, exportSchema = false)
abstract class CryptoHubDatabase : RoomDatabase() {

    abstract fun marketPairDao(): MarketPairDao

    companion object {
        @Volatile
        private var INSTANCE: CryptoHubDatabase? = null

        fun getDatabase(context: Context): CryptoHubDatabase {
            return INSTANCE ?: synchronized(this) {
                val instance = Room.databaseBuilder(
                    context.applicationContext,
                    CryptoHubDatabase::class.java,
                    "cryptohub_cache.db"
                ).build()
                INSTANCE = instance
                instance
            }
        }
    }
}
