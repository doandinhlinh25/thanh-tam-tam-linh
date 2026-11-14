package com.linh.document.configuration;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.data.mongodb.MongoDatabaseFactory;
import org.springframework.data.mongodb.MongoTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;

/** Transactions are confined to the Document-owned MongoDB database. */
@Configuration
public class MongoPersistenceConfiguration {
    @Bean
    public MongoTransactionManager documentTransactionManager(MongoDatabaseFactory factory) {
        return new MongoTransactionManager(factory);
    }
    @Bean
    public TransactionTemplate documentTransactions(MongoTransactionManager manager) {
        return new TransactionTemplate(manager);
    }
}
