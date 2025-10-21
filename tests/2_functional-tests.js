const chai = require('chai');
const chaiHttp = require('chai-http');
const assert = chai.assert;
const server = require('../server'); // Asegúrese de que server.js exporte la app

chai.use(chaiHttp);

let testThreadId;
let deleteThreadId; 
let testReplyId;
let replyToReportId; 

suite('Functional Tests', function() {

  this.timeout(5000); // Aumentar el tiempo de espera para solicitudes anidadas

  // ====================================================================
  // 1. Pruebas para /api/threads/:board
  // ====================================================================
  suite('API ROUTING FOR /api/threads/:board', function() {
    
    // 1. Crear un nuevo hilo
    test('1. Creating a new thread: POST request to /api/threads/{board}', function(done) {
      chai.request(server)
        .post('/api/threads/test')
        .send({
          text: 'FCC_TEST_THREAD_UNIQUE_1', // Usar texto único para encontrarlo
          delete_password: 'password123'
        })
        .redirects(0) 
        .end(function(err, res) {
          if (err) return done(err);
          // Verificar la redirección 303 (requisito de FCC)
          assert.equal(res.status, 303, 'Should redirect with status 303');
          
          // Obtener el ID del hilo recién creado para pruebas posteriores
          chai.request(server)
            .get('/api/threads/test')
            .end(function(err, res2) {
              if (err) return done(err);
              const createdThread = res2.body.find(t => t.text === 'FCC_TEST_THREAD_UNIQUE_1');
              assert.exists(createdThread, 'The created thread should exist');
              testThreadId = createdThread._id;

              // Crear otro hilo para la prueba de eliminación (Test 4)
              chai.request(server)
                .post('/api/threads/test')
                .send({
                  text: 'FCC_THREAD_TO_DELETE',
                  delete_password: 'deletepass'
                })
                .end(function(err, res3) {
                  if (err) return done(err);
                  // Obtener el ID del hilo para eliminar
                  chai.request(server)
                    .get('/api/threads/test')
                    .end(function(err, res4) {
                      if (err) return done(err);
                      const threadToDelete = res4.body.find(t => t.text === 'FCC_THREAD_TO_DELETE');
                      deleteThreadId = threadToDelete._id;
                      done(); 
                    });
                });
            });
        });
    });
    
    // 2. Ver los 10 hilos más recientes con 3 respuestas cada uno
    test('2. Viewing the 10 most recent threads with 3 replies each: GET request to /api/threads/{board}', function(done) {
      chai.request(server)
        .get('/api/threads/test')
        .end(function(err, res) {
          if (err) return done(err);
          assert.equal(res.status, 200);
          assert.isArray(res.body, 'Response should be an array of threads');
          assert.isAtMost(res.body.length, 10, 'Should return at most 10 threads');
          
          if (res.body.length > 0) {
            const firstThread = res.body[0];
            assert.property(firstThread, '_id', 'Thread should have _id');
            assert.isAtMost(firstThread.replies.length, 3, 'Each thread should have at most 3 replies');
            // Verificar campos sensibles ausentes
            assert.notProperty(firstThread, 'delete_password');
            assert.notProperty(firstThread, 'reported');
            if (firstThread.replies.length > 0) {
              assert.notProperty(firstThread.replies[0], 'delete_password');
            }
          }
          done();
        });
    });
    
    // 3. Eliminar un hilo con la contraseña incorrecta
    test('3. Deleting a thread with the incorrect password: DELETE request to /api/threads/{board}', function(done) {
      chai.request(server)
        .delete('/api/threads/test')
        .send({
          thread_id: testThreadId,
          delete_password: 'wrongpassword'
        })
        .end(function(err, res) {
          if (err) return done(err);
          assert.equal(res.status, 200);
          assert.equal(res.text, 'incorrect password', 'Should return incorrect password message');
          done();
        });
    });
    
    // 4. Eliminar un hilo con la contraseña correcta
    test('4. Deleting a thread with the correct password: DELETE request to /api/threads/{board}', function(done) {
      chai.request(server)
        .delete('/api/threads/test')
        .send({
          thread_id: deleteThreadId,
          delete_password: 'deletepass' // Contraseña correcta del hilo 'FCC_THREAD_TO_DELETE'
        })
        .end(function(err, res) {
          if (err) return done(err);
          assert.equal(res.status, 200);
          assert.equal(res.text, 'success', 'Should return success message');
          done();
        });
    });
    
    // 5. Reportar un hilo
    test('5. Reporting a thread: PUT request to /api/threads/{board}', function(done) {
      chai.request(server)
        .put('/api/threads/test')
        .send({
          thread_id: testThreadId
        })
        .end(function(err, res) {
          if (err) return done(err);
          assert.equal(res.status, 200);
          assert.equal(res.text, 'reported', 'Should return reported message');
          done();
        });
    });

  });
  
  // ====================================================================
  // 2. Pruebas para /api/replies/:board
  // ====================================================================
  suite('API ROUTING FOR /api/replies/:board', function() {
    
    // 6. Crear una nueva respuesta
    test('6. Creating a new reply: POST request to /api/replies/{board}', function(done) {
      chai.request(server)
        .post('/api/replies/test')
        .send({
          thread_id: testThreadId,
          text: 'FCC_TEST_REPLY_UNIQUE_1', // Usar texto único para encontrarlo
          delete_password: 'replypass'
        })
        .redirects(0) 
        .end(function(err, res) {
          if (err) return done(err);
          // Verificar la redirección 303 (requisito de FCC)
          assert.equal(res.status, 303, 'Should redirect with status 303');
          
          // Obtener el ID de la respuesta para pruebas posteriores
          chai.request(server)
            .get('/api/replies/test')
            .query({ thread_id: testThreadId })
            .end(function(err, res2) {
              if (err) return done(err);
              const createdReply = res2.body.replies.find(r => r.text === 'FCC_TEST_REPLY_UNIQUE_1');
              assert.exists(createdReply, 'The created reply should exist');
              testReplyId = createdReply._id;

              // Crear otra respuesta para la prueba de reporte (Test 10)
              chai.request(server)
                .post('/api/replies/test')
                .send({
                  thread_id: testThreadId,
                  text: 'FCC_REPLY_TO_REPORT',
                  delete_password: 'reportpass'
                })
                .end(function(err, res3) {
                  if (err) return done(err);
                  // Obtener el ID de la respuesta para reportar
                  chai.request(server)
                    .get('/api/replies/test')
                    .query({ thread_id: testThreadId })
                    .end(function(err, res4) {
                      if (err) return done(err);
                      const replyToReport = res4.body.replies.find(r => r.text === 'FCC_REPLY_TO_REPORT');
                      replyToReportId = replyToReport._id;
                      done(); // Finalizar el test
                    });
                });
            });
        });
    });
    
    // 7. Ver un solo hilo con todas las respuestas
    test('7. Viewing a single thread with all replies: GET request to /api/replies/{board}', function(done) {
      chai.request(server)
        .get('/api/replies/test')
        .query({ thread_id: testThreadId })
        .end(function(err, res) {
          if (err) return done(err);
          assert.equal(res.status, 200);
          assert.property(res.body, '_id');
          assert.equal(res.body._id, testThreadId);
          assert.isArray(res.body.replies);
          // Verificar que campos sensibles no estén presentes
          assert.notProperty(res.body, 'delete_password');
          assert.notProperty(res.body, 'reported');
          if (res.body.replies.length > 0) {
            assert.notProperty(res.body.replies[0], 'delete_password');
            assert.notProperty(res.body.replies[0], 'reported');
          }
          done();
        });
    });
    
    // 8. Eliminar una respuesta con la contraseña incorrecta
    test('8. Deleting a reply with the incorrect password: DELETE request to /api/replies/{board}', function(done) {
      chai.request(server)
        .delete('/api/replies/test')
        .send({
          thread_id: testThreadId,
          reply_id: testReplyId,
          delete_password: 'wrongpassword'
        })
        .end(function(err, res) {
          if (err) return done(err);
          assert.equal(res.status, 200);
          assert.equal(res.text, 'incorrect password', 'Should return incorrect password message');
          done();
        });
    });
    
    // 9. Eliminar una respuesta con la contraseña correcta
    test('9. Deleting a reply with the correct password: DELETE request to /api/replies/{board}', function(done) {
      chai.request(server)
        .delete('/api/replies/test')
        .send({
          thread_id: testThreadId,
          reply_id: testReplyId,
          delete_password: 'replypass' // Contraseña correcta
        })
        .end(function(err, res) {
          if (err) return done(err);
          assert.equal(res.status, 200);
          assert.equal(res.text, 'success', 'Should return success message');
          done();
        });
    });
    
    // 10. Reportar una respuesta
    test('10. Reporting a reply: PUT request to /api/replies/{board}', function(done) {
      chai.request(server)
        .put('/api/replies/test')
        .send({
          thread_id: testThreadId,
          reply_id: replyToReportId // ID de la respuesta a reportar
        })
        .end(function(err, res) {
          if (err) return done(err);
          assert.equal(res.status, 200);
          assert.equal(res.text, 'reported', 'Should return reported message');
          done();
        });
    });

  });

});