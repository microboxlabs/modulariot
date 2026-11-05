package com.microboxlabs.miot.core.alfresco;

import static org.junit.jupiter.api.Assertions.assertEquals;

import io.smallrye.mutiny.Uni;
import java.util.List;
import java.util.stream.IntStream;
import org.junit.jupiter.api.Test;

class AllGroupMembersTest {

    /** Answers in slices of at most 50, like the real client. */
    private static final class CappedDirectory implements IAlfrescoDirectoryClient {
        private final List<AlfrescoPerson> people = IntStream.range(0, 123)
                .mapToObj(i -> new AlfrescoPerson("p" + i + "@example.com", "p" + i + "@example.com", null, null,
                        null))
                .toList();

        @Override
        public Uni<List<AlfrescoPerson>> listGroupMembers(String groupId, int maxItems, int skipCount) {
            int size = Math.min(maxItems, 50);
            int from = Math.min(skipCount, people.size());
            return Uni.createFrom().item(people.subList(from, Math.min(from + size, people.size())));
        }

        @Override
        public Uni<String> getSiteRole(String personId, String siteId) {
            return Uni.createFrom().nullItem();
        }

        @Override
        public Uni<List<AlfrescoPerson>> searchPeople(String query, int maxItems) {
            return Uni.createFrom().item(List.of());
        }
    }

    @Test
    void readsEveryPageOfALargeGroup() {
        assertEquals(123, new CappedDirectory().listAllGroupMembers("GROUP_big").await().indefinitely().size());
    }
}
