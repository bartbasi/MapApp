// MapApp. Copyright 2026 Play, Inc.
// Free software under the GNU GPL v3 with additional terms: see LICENSE and NOTICE.

package io.github.bartbasi.mapapp.downloads;

import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertFalse;
import static org.junit.Assert.assertTrue;

import java.io.File;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicBoolean;
import java.util.concurrent.atomic.AtomicLong;
import org.junit.Rule;
import org.junit.Test;
import org.junit.rules.TemporaryFolder;

/** Removing an area always wins over the worker: nothing of it is left or can appear (review item 5). */
public class AreaGuardTest {

    @Rule
    public TemporaryFolder tmp = new TemporaryFolder();

    @Test
    public void aRemovedAreaCannotBeEnteredOrCommitted() throws Exception {
        AreaGuard g = new AreaGuard();
        g.markRemoved();
        assertFalse(g.enter());
        AtomicBoolean ran = new AtomicBoolean();
        assertFalse(g.commit(() -> ran.set(true)));
        assertFalse(ran.get());
        g.awaitOut();
    }

    @Test
    public void removeWaitsUntilTheWorkerIsOut() throws Exception {
        AreaGuard g = new AreaGuard();
        assertTrue(g.enter());
        AtomicLong removedAt = new AtomicLong();
        Thread remover = new Thread(() -> {
            g.markRemoved();
            try {
                g.awaitOut();
            } catch (InterruptedException e) {
                return;
            }
            removedAt.set(System.nanoTime());
        });
        remover.start();
        Thread.sleep(200);
        assertEquals("still waiting for the worker", 0, removedAt.get());
        long leftAt = System.nanoTime();
        g.leave();
        remover.join(5000);
        assertTrue(removedAt.get() >= leftAt);
    }

    /**
     * The race the review found: the worker writes "complete" at the moment the
     * user removes the area. Whichever comes first, after remove nothing exists.
     */
    @Test
    public void completeAndRemoveRacingLeaveNothing() throws Exception {
        for (int round = 0; round < 200; round++) {
            File dir = tmp.newFolder("area" + round);
            File complete = new File(dir, AreaLayout.COMPLETE);
            AreaGuard g = new AreaGuard();
            assertTrue(g.enter());
            CountDownLatch go = new CountDownLatch(1);
            Thread worker = new Thread(() -> {
                try {
                    go.await();
                    g.commit(() -> Files.writeAtomically(complete, new byte[0]));
                } catch (Exception e) {
                    throw new RuntimeException(e);
                } finally {
                    g.leave();
                }
            });
            worker.start();
            go.countDown();
            if (round % 2 == 0) Thread.yield();
            g.markRemoved();
            g.awaitOut();
            Files.deleteTree(dir);
            worker.join(5000);
            assertFalse("round " + round, dir.exists());
            assertFalse(complete.exists());
            // And the worker can never come back.
            assertFalse(g.enter());
        }
    }

    @Test(timeout = 5000)
    public void awaitOutReturnsAtOnceWhenTheWorkerIsElsewhere() throws Exception {
        AreaGuard g = new AreaGuard();
        g.markRemoved();
        g.awaitOut();
        assertTrue(g.isRemoved());
        assertTrue(new CountDownLatch(0).await(0, TimeUnit.SECONDS));
    }
}
